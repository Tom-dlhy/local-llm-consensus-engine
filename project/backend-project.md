# Backend Project - Justifications Techniques

Ce document récapitule les choix d'architecture et de conception du backend LLM Council.

## 🏗️ Architecture Distribuée PC1/PC2

### Choix: Master/Worker Pattern

**Justification**: L'architecture distribuée avec un **Master (PC1)** et un **Worker (PC2)** permet:
- **Séparation des responsabilités**: Le Master orchestre le workflow complet (Stage 1-2-3), le Worker se concentre sur l'inférence LLM
- **Scalabilité**: Possibilité d'ajouter plusieurs Workers si nécessaire
- **Isolement des ressources**: Les ressources GPU/CPU du Worker sont dédiées aux LLMs

### Rôle du Chairman

Le Chairman n'est pas un service séparé mais une **responsabilité du Master**. Cela simplifie l'architecture tout en respectant la contrainte "Chairman sur PC #1".

```
PC 1 (Master)                    PC 2 (Worker)
├── Orchestration                ├── Ollama API
├── Stage 1: Dispatch agents     ├── /api/generate
├── Stage 2: Dispatch reviews    └── Multi-model parallel
└── Stage 3: Chairman synthesis
```

## 📦 Stack Technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Framework API** | FastAPI | Async natif, WebSocket support, OpenAPI auto-généré |
| **Configuration** | Pydantic Settings | Validation forte, env vars, type safety |
| **HTTP Client** | httpx | Async, timeouts configurables, streaming |
| **Monitoring** | psutil | Léger, cross-platform, CPU/RAM metrics |

## ⏱️ Gestion des Timeouts

**Problème**: Les LLMs peuvent prendre 30-60s par réponse, surtout avec 5 modèles en parallèle.

**Solution**: 
- Timeout par défaut: **120 secondes**
- Connect timeout: **10 secondes** (détection rapide des erreurs réseau)
- Configurable via `GENERATION_TIMEOUT`

```python
httpx.Timeout(120.0, connect=10.0)
```

## 🔄 Parallélisme et Concurrence

### Configuration Ollama (PC2)
```bash
export OLLAMA_NUM_PARALLEL=5       # 5 requêtes simultanées
export OLLAMA_MAX_LOADED_MODELS=5  # 5 modèles en mémoire
```

### Code Async
```python
# Stage 1: Toutes les opinions en parallèle
responses = await asyncio.gather(*[generate(agent) for agent in agents])
```

**Justification**: `asyncio.gather` permet de lancer les N requêtes instantanément. Le Worker traite en parallèle (limité par OLLAMA_NUM_PARALLEL).

## 🆔 Gestion des IDs Uniques

**Problème**: L'utilisateur peut sélectionner 2x le même modèle (ex: 2 instances de `llama3.2:1b`).

**Solution**: Chaque agent reçoit un ID unique (`agent_1`, `agent_2`) indépendamment du modèle:

```python
for i, agent in enumerate(request.selected_agents):
    agent_id = f"agent_{i + 1}"
```

Cela permet au Chairman de distinguer les contributions lors de la synthèse.

## 📋 JSON Mode (Stage 2)

**Problème**: Le Stage 2 (Review) nécessite un format structuré pour extraire les scores.

**Solution**: Utilisation du paramètre `format: "json"` d'Ollama:

```python
response = await ollama.generate(
    model=model,
    prompt=review_prompt,
    format="json"  # Force JSON output
)
```

**Prompt structuré**:
```
Respond ONLY with valid JSON in the following format:
{
    "rankings": [
        {"agent_id": "<id>", "score": <1-10>, "reasoning": "<explanation>"}
    ]
}
```

## 📡 API Design

### Worker (`/api/generate`)
- Endpoint simple et stateless
- Compatible avec le workflow Master
- Batch endpoint pour optimisation future

### Master (`/api/council/*`)
- Session-based (UUID tracking)
- WebSocket pour streaming
- Liste des modèles recommandés

### Health Checks
- `/health`: Statut du service
- `/health/system`: CPU/RAM usage
- `/health/ollama`: Connexion Ollama
- `/health/models`: Modèles disponibles

## 📊 Token Usage Estimation

### Objectif
Suivi complet de la consommation de tokens à travers les 3 phases du workflow, permettant l'affichage de métriques détaillées dans le frontend.

### Modèles de Données

```python
class TokenUsage(BaseModel):
    """Usage pour une génération individuelle."""
    prompt_tokens: int      # Tokens d'entrée (prompt_eval_count)
    completion_tokens: int  # Tokens générés (eval_count)
    total_tokens: int       # Total

class StageTokenUsage(BaseModel):
    """Usage agrégé par phase."""
    stage: str                           # "opinions", "review", "synthesis"
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    by_model: dict[str, TokenUsage]      # Breakdown par modèle

class SessionTokenUsage(BaseModel):
    """Usage complet de la session."""
    stage1_opinions: StageTokenUsage | None
    stage2_review: StageTokenUsage | None
    stage3_synthesis: StageTokenUsage | None
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int

class SessionLatencyStats(BaseModel):
    """Latence complète de la session (KPI)."""
    stage1_opinions: StageLatencyStats | None
    stage2_review: StageLatencyStats | None
    stage3_synthesis: StageLatencyStats | None
    total_duration_ms: int
```

### Réponse API

Le champ `token_usage` est maintenant inclus dans `CouncilSession`:

```json
{
  "token_usage": {
    "stage1_opinions": {
      "stage": "opinions",
      "total_prompt_tokens": 244,
      "total_completion_tokens": 256,
      "total_tokens": 500,
      "by_model": {
        "gemma2:2b": {"prompt_tokens": 82, "completion_tokens": 61, "total_tokens": 143},
        "qwen2.5:0.5b": {"prompt_tokens": 81, "completion_tokens": 96, "total_tokens": 177}
      }
    },
    "stage2_review": { ... },
    "stage3_synthesis": { ... },
    "total_prompt_tokens": 2038,
    "total_completion_tokens": 1202,
    "total_tokens": 3240
  }
}
```

### Métriques de Test (3 agents)

| Stage | Prompt | Completion | Total |
|-------|--------|------------|-------|
| Stage 1 (Opinions) | 244 | 256 | 500 |
| Stage 2 (Review) | 1,293 | 594 | 1,887 |
| Stage 3 (Synthesis) | 501 | 352 | 853 |
| **TOTAL** | **2,038** | **1,202** | **3,240** |

### Implémentation

- `_generate_opinion()`: Capture `prompt_eval_count` et `eval_count` d'Ollama
- `_generate_review()`: Idem pour les reviews
- `stage3_synthesis()`: Idem pour le Chairman
- `_calculate_stage_usage()`: Agrège par modèle
- `_update_total_usage()`: Calcule les totaux globaux

## 🎯 Modèles Recommandés

| Modèle | Taille | Rôle Optimal |
|--------|--------|--------------|
| `qwen2.5:0.5b` | 350 MB | Opinions rapides (Stage 1) |
| `llama3.2:1b` | 1.3 GB | Review/notation (Stage 2) |
| `gemma2:2b` | 1.6 GB | Expert précis |
| `phi3.5:mini` | 2.2 GB | Chairman (Stage 3) |
| `tinyllama` | 600 MB | Backup léger |

**Note**: GPT-2 exclu car incapable de produire du JSON structuré fiable.

## 🔐 Sécurité

- CORS configuré (à restreindre en production)
- Pas d'authentification (réseau local assumé)
- Validation Pydantic sur tous les inputs

## 📈 Évolutions Futures

1. **Caching**: Mise en cache des réponses identiques
2. **Queue System**: Redis/RabbitMQ pour gérer la charge
3. **Multi-Worker**: Load balancing entre plusieurs PC2
4. **Metrics**: Prometheus/Grafana pour monitoring avancé
5. **Cost Estimation**: Estimation du coût équivalent API cloud basée sur les tokens
6. **Detailed Tracing**: OpenTelemetry tracing pour voir la latence de chaque span (réseau vs LLM)

