#!/usr/bin/env python3
"""
Test script for the LLM Council pipeline.

Usage:
    cd backend
    uv run python test.py

Requirements:
    - Ollama running locally
    - Recommended models installed (run 'uv run python -m src.scripts.setup_models' if available, or pull manually)
"""

import asyncio
import json
import logging
from datetime import datetime

# Configure logging to avoid noise from imported modules
logging.basicConfig(level=logging.WARNING)

from src.models import AgentConfig, CouncilRequest
from src.services import CouncilService, OllamaClient
from src.api.council_routes import RECOMMENDED_MODELS


def get_preferred_models(installed_models: list[str]) -> dict:
    """Select best available models from recommendations, excluding phi3.5."""
    
    # Filter out phi3.5 from recommendations
    allowed_recommendations = [
        m for m in RECOMMENDED_MODELS 
        if "phi3.5" not in m["name"]
    ]
    
    available = {}
    
    # Helper to find a model from recommendations that is installed
    def find_model(role_hint=None, specific_name=None):
        # First try specific name if given
        if specific_name and specific_name in installed_models:
            return specific_name
            
        # Then try by role
        if role_hint:
            for rec in allowed_recommendations:
                if rec.get("recommended_role") == role_hint and rec["name"] in installed_models:
                    return rec["name"]
        
        # Then try any allowed recommendation
        for rec in allowed_recommendations:
            if rec["name"] in installed_models:
                return rec["name"]
                
        # Finally fallback to any installed model that isn't phi3.5
        for m in installed_models:
            if "phi3.5" not in m:
                return m
        return None

    # Select models for specific tasks
    available["fast"] = find_model(specific_name="qwen2.5:0.5b")
    available["smart"] = find_model(specific_name="llama3.2:1b")
    available["expert"] = find_model(specific_name="gemma2:2b")
    available["backup"] = find_model(specific_name="tinyllama")
    
    # Fill gaps if specific ones are missing
    fallback = find_model()
    for k in ["fast", "smart", "expert", "backup"]:
        if not available[k]:
            available[k] = fallback
            
    return available


async def test_ollama_connection():
    """Test that Ollama is running and accessible."""
    print("\n" + "=" * 60)
    print("🔍 Testing Ollama Connection...")
    print("=" * 60)

    client = OllamaClient()
    try:
        is_healthy = await client.health_check()
        if is_healthy:
            print("✅ Ollama is running")

            models = await client.list_models()
            model_names = [m.get("name") for m in models]
            
            print(f"📦 Installed models ({len(models)}):")
            for m in model_names:
                print(f"   - {m}")

            print("\n🎯 Recommended configuration status:")
            all_present = True
            for rec in RECOMMENDED_MODELS:
                if "phi3.5" in rec["name"]:
                    continue
                status = "✅" if rec["name"] in model_names else "❌"
                if status == "❌":
                    all_present = False
                print(f"   {status} {rec['name']:<15} ({rec['description']})")

            if not all_present:
                 print("\n⚠️  Some recommended models are missing. The test will try to fallback.")
            
            return True, model_names
        else:
            print("❌ Ollama is not responding")
            print("   Run: ollama serve")
            return False, []
    finally:
        await client.close()


async def test_single_generation(preferred_models):
    """Test a single LLM generation."""
    print("\n" + "=" * 60)
    print("🧪 Testing Single Generation...")
    print("=" * 60)

    model_name = preferred_models.get("fast")
    if not model_name:
        print("❌ No suitable model available for generation")
        return False

    print(f"Using model: {model_name}")
    client = OllamaClient()
    try:
        start = datetime.now()
        response = await client.generate(
            model=model_name,
            prompt="What is 2+2? Answer in one word.",
        )
        duration = (datetime.now() - start).total_seconds()

        content = response.get("response", "")
        tokens = response.get("eval_count", 0)

        print(f"✅ Response: {content.strip()}")
        print(f"   Tokens: {tokens}, Duration: {duration:.2f}s")
        return True

    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return False
    finally:
        await client.close()


async def test_json_mode(preferred_models):
    """Test JSON mode for Stage 2 reviews."""
    print("\n" + "=" * 60)
    print("📋 Testing JSON Mode (Stage 2 format)...")
    print("=" * 60)

    # Llama 3.2 is best for JSON/reasoning
    model_name = preferred_models.get("smart") 
    if not model_name:
        print("❌ No suitable model available for JSON test")
        return False

    print(f"Using model: {model_name}")
    client = OllamaClient()
    try:
        prompt = """Evaluate these two responses and rank them.

Response A: "Python is great for data science because of pandas and numpy."
Response B: "Python has many libraries for machine learning."

Respond with JSON only:
{"rankings": [{"id": "A", "score": 8, "reason": "..."}, {"id": "B", "score": 7, "reason": "..."}]}"""

        response = await client.generate(
            model=model_name,
            prompt=prompt,
            format="json",
        )

        content = response.get("response", "")
        print(f"Raw response: {content[:100]}...")

        # Try to parse as JSON
        try:
            data = json.loads(content)
            print(f"\n✅ Valid JSON parsed with {len(data.get('rankings', []))} rankings")
            return True
        except json.JSONDecodeError as e:
            print(f"\n⚠️  JSON parse error: {e}")
            return False

    finally:
        await client.close()


async def test_full_council_pipeline(preferred_models):
    """Test the complete 3-stage council workflow."""
    print("\n" + "=" * 60)
    print("🏛️  Testing Full Council Pipeline...")
    print("=" * 60)

    # Setup agents
    # We want 3 distinct agents if possible
    # 1. Expert (Gemma)
    # 2. Fast (Qwen)
    # 3. Smart (Llama) or Backup (TinyLlama)
    
    agent_configs = []
    
    # Agent 1: The Expert
    if preferred_models.get("expert"):
        agent_configs.append(AgentConfig(
            name="Expert_Gemma", 
            model=preferred_models["expert"]
        ))
    
    # Agent 2: The Fast One
    if preferred_models.get("fast") and (len(agent_configs) == 0 or preferred_models["fast"] != agent_configs[0].model):
         agent_configs.append(AgentConfig(
            name="Expert_Qwen", 
            model=preferred_models["fast"]
        ))
         
    # Agent 3: The Smart One (if not used) or Backup
    p3 = preferred_models.get("smart") or preferred_models.get("backup")
    if p3:
        # Avoid duplicate models if we have enough variety
        used_models = {a.model for a in agent_configs}
        if p3 not in used_models or len(agent_configs) < 2:
             agent_configs.append(AgentConfig(
                name="Expert_Llama", 
                model=p3
            ))

    # Fill up to 3 agents if needed by reusing
    while len(agent_configs) < 3:
        i = len(agent_configs)
        base = agent_configs[i % len(agent_configs)] if agent_configs else None
        if not base:
             print("❌ No models available to form a council")
             return False
        agent_configs.append(AgentConfig(
            name=f"Expert_{i+1}", 
            model=base.model
        ))
    
    # Chairman: Use the 'smart' model (Llama 3.2 presumably) since Phi-3.5 is banned
    chairman_model = preferred_models.get("smart")
    
    if not chairman_model:
        print("❌ No chairman model available")
        return False

    # Create council request
    request = CouncilRequest(
        query="What are the main benefits of using Python for data science? Keep your answer brief (2-3 sentences).",
        selected_agents=agent_configs,
        chairman_model=chairman_model,
    )

    print(f"\n📝 Query: {request.query}")
    print(f"👥 Agents: {[(a.name, a.model) for a in request.selected_agents]}")
    print(f"🎩 Chairman model: {request.chairman_model}")

    # Run the council
    service = CouncilService()

    try:
        print("\n⏳ Running council workflow...")
        start = datetime.now()
        session = await service.run_council(request)
        total_duration = (datetime.now() - start).total_seconds()

        # Display results
        print("\n" + "-" * 60)
        print("📊 RESULTS")
        print("-" * 60)

        print(f"\n🆔 Session ID: {session.session_id}")
        print(f"📈 Final Stage: {session.stage.value}")
        print(f"⏱️  Total Duration: {total_duration:.2f}s")

        if session.error:
            print(f"\n❌ Error: {session.error}")
            return False

        # Stage 1 results
        print("\n📢 STAGE 1 - First Opinions:")
        for op in session.opinions:
            print(f"\n   [{op.agent_name}] ({op.model}):")
            print(f"   {op.content[:200]}{'...' if len(op.content) > 200 else ''}")

        # Stage 3 results
        if session.final_answer:
            print("\n🎯 STAGE 3 - Chairman's Final Answer:")
            print(f"\n   {session.final_answer.content}")
            print(f"\n   (model: {session.final_answer.chairman_model})")

        # Token Usage Summary
        print("\n" + "-" * 60)
        print("📈 TOKEN USAGE SUMMARY")
        print("-" * 60)

        usage = session.token_usage

        if usage.stage1_opinions:
            s1 = usage.stage1_opinions
            print(f"\n   Stage 1 (Opinions):")
            print(f"      Prompt: {s1.total_prompt_tokens:,} | Completion: {s1.total_completion_tokens:,} | Total: {s1.total_tokens:,}")
            if s1.by_model:
                for model, mu in s1.by_model.items():
                    print(f"         └─ {model}: {mu.total_tokens:,} tokens")

        if usage.stage2_review:
            s2 = usage.stage2_review
            print(f"\n   Stage 2 (Review):")
            print(f"      Prompt: {s2.total_prompt_tokens:,} | Completion: {s2.total_completion_tokens:,} | Total: {s2.total_tokens:,}")

        if usage.stage3_synthesis:
            s3 = usage.stage3_synthesis
            print(f"\n   Stage 3 (Synthesis):")
            print(f"      Prompt: {s3.total_prompt_tokens:,} | Completion: {s3.total_completion_tokens:,} | Total: {s3.total_tokens:,}")

        print(f"\n   📊 TOTAL TOKENS: {usage.total_tokens:,}")
        print(f"      (Prompt: {usage.total_prompt_tokens:,} | Completion: {usage.total_completion_tokens:,})")

        print("\n" + "=" * 60)
        print("✅ PIPELINE TEST SUCCESSFUL!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        return False


async def main():
    """Run all tests."""
    print("\n" + "🚀" * 20)
    print("   LLM COUNCIL - PIPELINE TEST")
    print("🚀" * 20)
    print("ℹ️  Mode: Recommended Models (No Phi-3.5)")

    results = {}

    # Test 1: Ollama connection & Model Discovery
    success, installed_models = await test_ollama_connection()
    results["ollama_connection"] = success
    
    if not success or not installed_models:
        print("\n⛔ Cannot continue without Ollama and models. Exiting.")
        return

    # Determine which models to use based on what's installed + recommendations
    preferred_models = get_preferred_models(installed_models)
    print(f"\n🤖 Selected Model Configuration:")
    print(f"   - Fast/Opinions: {preferred_models.get('fast')}")
    print(f"   - Reasoning/JSON: {preferred_models.get('smart')}")
    print(f"   - Expert/Knowledge: {preferred_models.get('expert')}")

    if not any(preferred_models.values()):
         print("\n⛔ No usable models found (excluding phi3.5). Please install models from src/api/council_routes.py")
         return

    # Test 2: Single generation
    results["single_generation"] = await test_single_generation(preferred_models)

    # Test 3: JSON mode
    results["json_mode"] = await test_json_mode(preferred_models)

    # Test 4: Full pipeline
    results["full_pipeline"] = await test_full_council_pipeline(preferred_models)

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name}: {status}")

    all_passed = all(results.values())
    print("\n" + ("🎉 All tests passed!" if all_passed else "⚠️  Some tests failed"))


if __name__ == "__main__":
    asyncio.run(main())
