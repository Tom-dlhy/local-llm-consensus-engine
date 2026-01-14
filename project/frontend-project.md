# Frontend Project - LLM Council

Ce document décrit l'architecture et les choix de conception du frontend React.

## 🏗️ Architecture des Composants

### Structure du Dossier

```
src/
├── components/
│   ├── council/          # Composants métier du Council
│   │   ├── ModelSelector.tsx
│   │   ├── QueryForm.tsx
│   │   ├── StageProgress.tsx
│   │   ├── OpinionCard.tsx
│   │   ├── ReviewCard.tsx
│   │   ├── FinalAnswerCard.tsx
│   │   ├── TokenUsageStats.tsx
│   │   ├── SessionSummary.tsx
│   │   ├── EmptyState.tsx
│   │   └── index.ts
│   └── ui/               # Composants shadcn/radix
├── context/              # React Context (SessionContext)
├── routes/               # Pages (logique minimale)
├── services/             # API clients
└── types/                # TypeScript types (miroir backend)
```

### Philosophie

1. **Logique dans les composants, pas les pages** - Les pages orchestrent les composants mais ne contiennent pas de JSX complexe
2. **Composants shadcn/radix** - Utilisation systématique des composants UI de shadcn
3. **Types alignés avec le backend** - `types/council.ts` est un miroir des models Pydantic

---

## 📦 Composants Council

| Composant | Description | Props principales |
|-----------|-------------|-------------------|
| `ModelSelector` | Grille de sélection des modèles | `models`, `selectedModels`, `onToggle` |
| `QueryForm` | Formulaire de question | `query`, `onSubmit`, `isLoading` |
| `StageProgress` | Indicateur de progression par stage | `stage`, `status`, `agentCount` |
| `OpinionCard` | Affiche une opinion d'agent (Stage 1) | `opinion: AgentResponse` |
| `ReviewCard` | Affiche un review avec scores (Stage 2) | `review: ReviewResult` |
| `FinalAnswerCard` | Réponse finale du Chairman (Stage 3) | `answer: FinalAnswer` |
| `TokenUsageStats` | Statistiques de tokens par stage | `tokenUsage: SessionTokenUsage` |
| `SessionSummary` | Résumé avec compteurs | `agentCount`, `opinionsCount` |
| `EmptyState` | État vide / avertissement | `title`, `message` |

---

## 📊 Types (Miroir Backend)

### Token Usage

```typescript
interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface StageTokenUsage {
  stage: string // 'opinions' | 'review' | 'synthesis'
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  by_model: Record<string, TokenUsage>
}

interface SessionTokenUsage {
  stage1_opinions: StageTokenUsage | null
  stage2_review: StageTokenUsage | null
  stage3_synthesis: StageTokenUsage | null
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
}
```

### Session Model

```typescript
interface CouncilSession {
  session_id: string
  query: string
  stage: SessionStage
  agents: AgentConfig[]
  opinions: AgentResponse[]
  reviews: ReviewResult[]
  token_usage: SessionTokenUsage  // NEW
  final_answer: FinalAnswer | null
  error: string | null
}
```

---

## 🎨 Stack Technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Framework** | React + TanStack Router | Routing type-safe, SSR ready |
| **Build** | Vite | HMR rapide, bundling optimisé |
| **UI** | shadcn/ui + Radix | Composants accessibles, stylés avec Tailwind |
| **State** | React Context | Suffisant pour le state de session |
| **Styling** | Tailwind CSS | Utility-first, dark mode natif |

---

## 📄 Pages

### Chat (`/`)
- Sélection des modèles
- Formulaire de question
- Affichage de la progression
- Réponse finale du Chairman

### Responses (`/responses`)
- Question originale
- Liste des opinions (Stage 1)
- Reviews et rankings (Stage 2)
- Résumé de la session

### KPIs (`/kpis`)
- Statistiques de tokens par stage (avec onglets)
- KPIs généraux (sessions, agents, tokens, reviews)

---

## 🔌 API Client

Le service `councilApiService` gère:
- `getModels()` - Liste des modèles disponibles
- `startCouncil(request)` - Démarre une délibération
- `getSession(id)` - Récupère une session
- `subscribeToSession(id, callbacks)` - WebSocket pour mises à jour temps réel

---

## 🚀 Évolutions Futures

1. **Historique des sessions** - Persistance localStorage
2. **Graphiques** - Recharts pour visualisation des tokens
3. **Export** - Export PDF/Markdown des délibérations
4. **Mode offline** - PWA avec cache des sessions

## 📈 Visualisations & KPIs

### Page `/kpis`

1. **Token Usage**:
   - Stats par défaut: Prompt / Completion / Total
   - Pie Chart: Distribution par modèle actif
   - Onglets: Summary (Total) / Opinions / Review / Synthesis

2. **Latency Per Model**:
   - Bar Chart: Temps d'attente (ms) par modèle
   - Agrégation par étape (sauf summary qui montre E2E)
   - Permet d'identifier les goulets d'étranglement

3. **Models (Radar Charts)**:
   - Un graphique radar par modèle
   - 5 métriques normalisées (0-100): Score, Latency S1, Latency S2, Tokens S1, Tokens S2
   - Permet de comparer les performances de chaque modèle
