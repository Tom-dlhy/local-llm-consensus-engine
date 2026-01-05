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
