# 🧠 Local LLM Consensus Engine

Un système de consensus distribué utilisant plusieurs LLMs locaux via Ollama. Les agents délibèrent, se notent mutuellement, et un Chairman synthétise la réponse finale.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORKFLOW                                 │
│  Stage 1: Opinions  →  Stage 2: Reviews  →  Stage 3: Synthesis  │
└─────────────────────────────────────────────────────────────────┘

Mode Solo (1 PC)                    Mode Distribué (2 PCs)
┌─────────────────────┐            ┌─────────────┐    ┌─────────────┐
│ Master + Worker     │            │ PC1 (Master)│───▶│ PC2 (Worker)│
│ localhost:8000/8001 │            │ Chairman    │    │ Ollama LLMs │
└─────────────────────┘            └─────────────┘    └─────────────┘
```

---

## 📦 Prérequis

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** - Gestionnaire de paquets Python
- **[Ollama](https://ollama.ai/)** - Runtime LLM local
- **Node.js 18+** (pour le frontend)

---

## 🤖 Installation des Modèles Ollama

### Modèles essentiels

```bash
ollama pull qwen2.5:0.5b    # Opinions rapides (350 MB)
ollama pull llama3.2:1b     # Review/notation (1.3 GB)
ollama pull phi3.5:latest   # Chairman (2.2 GB)
```

### Modèles optionnels

```bash
ollama pull gemma2:2b       # Expert précis (1.6 GB)
ollama pull tinyllama       # Backup léger (600 MB)
```

---

## 🚀 Lancement du Projet

### Option 1 : Mode Solo (Développement)

Tout sur une seule machine avec deux terminaux.

#### Terminal 1 - Worker (Inférence LLM)

```bash
# Configuration Ollama pour le parallélisme
export OLLAMA_NUM_PARALLEL=5
export OLLAMA_MAX_LOADED_MODELS=5

# Lancer Ollama
ollama serve
```

#### Terminal 2 - Backend Worker

```bash
cd backend
uv sync
uv run python -m src.main --role worker --port 8001
```

#### Terminal 3 - Backend Master

```bash
cd backend
uv run python -m src.main --role master --worker-url http://localhost:8001
```

#### Terminal 4 - Frontend

```bash
cd frontend
npm install
npm run dev
```

**Accès :**
- 🌐 Frontend : http://localhost:5173
- 📡 API Master : http://localhost:8000
- 📚 API Docs : http://localhost:8000/docs

---

### Option 2 : Mode Distribué (2 PCs)

Architecture optimale avec séparation des ressources.

#### 🖥️ PC 2 - Worker (Machine avec GPU/ressources LLM)

```bash
# 1. Configuration Ollama
export OLLAMA_NUM_PARALLEL=5
export OLLAMA_MAX_LOADED_MODELS=5
ollama serve

# 2. Lancer le Worker (nouveau terminal)
cd backend
uv sync
uv run python -m src.main --role worker --host 0.0.0.0 --port 8000
```

> **Note :** `--host 0.0.0.0` permet les connexions depuis le réseau local.

#### 🖥️ PC 1 - Master (Orchestration + Chairman)

```bash
# 1. Lancer le Master (remplacer IP_DU_PC2)
cd backend
uv sync
uv run python -m src.main --role master --worker-url http://IP_DU_PC2:8000

# 2. Lancer le Frontend (nouveau terminal)
cd frontend
npm install
npm run dev
```

**Exemple avec IP :**
```bash
uv run python -m src.main --role master --worker-url http://192.168.1.42:8000
```

---

## ⚙️ Variables d'Environnement

Créez un fichier `.env` dans le dossier `backend/` :

```env
# Rôle du serveur
ROLE=master  # ou "worker"

# Configuration réseau
HOST=0.0.0.0
PORT=8000

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Master only
WORKER_URL=http://localhost:8001
CHAIRMAN_MODEL=phi3.5:latest

# Timeouts (secondes)
GENERATION_TIMEOUT=120
```

---

## 📡 Vérification du Setup

### Tester la connexion Ollama

```bash
curl http://localhost:11434/api/tags
```

### Tester le Worker

```bash
curl http://localhost:8001/health
curl http://localhost:8001/health/models
```

### Tester le Master

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/council/models
```

---

## 🧪 Exemple de Requête API

```bash
curl -X POST http://localhost:8000/api/council/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Quelle est la meilleure approche pour apprendre la programmation ?",
    "selected_agents": [
      {"name": "Expert_1", "model": "qwen2.5:0.5b"},
      {"name": "Expert_2", "model": "llama3.2:1b"},
      {"name": "Expert_3", "model": "gemma2:2b"}
    ],
    "chairman_model": "phi3.5:latest"
  }'
```

---

## 📂 Structure du Projet

```
local-llm-consensus-engine/
├── backend/                 # API FastAPI
│   ├── src/
│   │   ├── main.py         # Point d'entrée CLI
│   │   ├── config.py       # Configuration Pydantic
│   │   ├── models/         # Modèles de données
│   │   ├── services/       # Logique métier (Council, Ollama)
│   │   └── api/            # Routes FastAPI
│   └── pyproject.toml
├── frontend/                # Interface React/Vite
└── project/                 # Documentation technique
```

---

## 🔧 Dépannage

| Problème | Solution |
|----------|----------|
| `Connection refused` sur Worker | Vérifiez que Ollama tourne (`ollama serve`) |
| Timeout sur génération | Augmentez `GENERATION_TIMEOUT` ou utilisez des modèles plus légers |
| Modèle non trouvé | Exécutez `ollama pull <model>` |
| CORS error | Le Master doit tourner sur le port attendu par le frontend |

---

## 📚 Documentation

- **API Swagger** : http://localhost:8000/docs
- **ReDoc** : http://localhost:8000/redoc
- **Architecture détaillée** : [project/backend-project.md](project/backend-project.md)
