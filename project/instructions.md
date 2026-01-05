# 🏛️ Project: LLM Council Local Deployment

## 📋 Project Overview

Ce projet est inspiré du concept **"LLM Council"** d'Andrej Karpathy. Au lieu de s'appuyer sur un seul modèle, plusieurs LLM collaborent : ils répondent, révisent et synthétisent les réponses à une requête utilisateur.

**Objectif :** Refactoriser le système original (basé sur le cloud via OpenRouter) pour qu'il fonctionne **entièrement localement** de manière distribuée sur plusieurs machines.

---

## ⚙️ Council Workflow (Les 3 Étapes)

1. **Stage 1: First Opinions**
* L'utilisateur soumet une requête.
* Chaque LLM génère une réponse indépendamment.
* Interface à onglets pour inspecter chaque réponse individuelle.


2. **Stage 2: Review & Ranking**
* Chaque LLM analyse les réponses des autres (anonymisées).
* Classement basé sur la précision et la pertinence.


3. **Stage 3: Chairman Final Answer**
* Un **Chairman LLM** dédié reçoit les réponses originales et les classements.
* Il synthétise le tout en une réponse finale unique.



---

## 🛠️ Mandatory Technical Requirements

### 1. Local LLM Execution

Remplacement des API Cloud par des frameworks d'inférence locale :

* **Ollama (recommandé)**, GPT4All, Llamafile, Hugging Face ou LangChain.

### 2. Distributed Architecture

Le système doit être distribué sur plusieurs machines via des **API REST** :

* **Groupe de 2 :** Chairman sur PC #1, tous les agents sur PC #2.

### 3. Chairman Separation

* Service séparé des autres agents.
* Instance de modèle propre.
* Rôle exclusif de synthèse (ne génère pas d'opinion au Stage 1).

---

## 👥 Team & Submission Rules

* **Taille :** 1 à 5 étudiants (même groupe de TD uniquement).
* **Livrables :** Un seul rendu par équipe sur DVL comprenant :
* Le **Code Source** complet.
* Un **README.md** (Membres, Installation, Instructions de démo).
* Un **Rapport Technique** (Choix design, modèles choisis, améliorations).


* **Déclaration IA Générative :** Mentionner obligatoirement l'usage d'outils (ex: ChatGPT) et leur but (refacto, debug, etc.). *Une omission entraînera une pénalité sévère.*

---

## ✨ Optional Enhancement Ideas (Bonus)

* **Monitoring :** Santé des modèles (heartbeat), estimation des tokens, latence.
* **UI/UX :** Mode sombre, code couleur par modèle, panneaux rétractables.
* **Visualisation :** Dashboard de performance, graphiques de classement, indicateurs de statut (IDLE, BUSY).

---

## 🏆 Evaluation Criteria

| Critère | Description |
| --- | --- |
| **Qualité du code** | Structure propre, modularité, lisibilité. |
| **Fonctionnalité** | Workflow complet (Stages 1–3) parfaitement fonctionnel. |
| **Améliorations** | Ajouts au-delà du repo original. |
| **Documentation** | Guide d'installation et architecture clairs. |
| **Démo en direct** | Présentation fluide, rôles clairs, preuve du multi-machines. |