#!/bin/bash
# start_dev.sh - Lance le Master et le Worker sur la même machine pour le développement

# Fonction pour tuer les processus enfants à la sortie (CTRL+C)
cleanup() {
    echo "🛑 Arrêt des services..."
    kill $(jobs -p) 2>/dev/null
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Lancer le Worker sur le port 8001 (Inférence)
echo "🏗️  Démarrage du Worker (Port 8001)..."
# On utilise & pour le lancer en arrière-plan
uv run python -m src.main --role worker --port 8001 &
WORKER_PID=$!

# Attendre un peu que le Worker s'initialise
sleep 3

# 2. Lancer le Master sur le port 8000 (Orchestration)
echo "👑 Démarrage du Master (Port 8000)..."
# Le Master pointe vers le Worker local
uv run python -m src.main --role master --worker-url http://localhost:8001 --port 8000 &
MASTER_PID=$!

# Attendre que les deux processus finissent (ou qu'on fasse CTRL+C)
wait $MASTER_PID $WORKER_PID
