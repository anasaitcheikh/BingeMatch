# 🎬 CineAI — Recommandations Cinématographiques Intelligentes

Un site web moderne et premium de recommandations de films, séries et animés propulsé par l'IA.

## ✨ Fonctionnalités

- **Test Psychologique** — Quiz en 6 questions pour des recommandations selon votre humeur
- **Analyse de goûts** — Entrez vos favoris, l'IA trouve des contenus similaires
- **Mode sombre** — UI immersive inspirée de Netflix/Apple TV
- **Sauvegarde locale** — Vos likes et historique persistent entre sessions
- **TMDB Integration** — Vraies affiches, notes et données en temps réel
- **Responsive** — Mobile et desktop parfaitement optimisés

## 🚀 Déploiement sur Vercel

### 1. Clé API TMDB (gratuite)

1. Créez un compte sur [themoviedb.org](https://www.themoviedb.org)
2. Allez dans **Settings → API → Create → Developer**
3. Copiez votre **API Key (v3 auth)**

### 2. Déploiement

```bash
# Installer Vercel CLI
npm i -g vercel

# Dans le dossier du projet
cd cineai
npm install

# Déployer
vercel

# Quand demandé, ajoutez la variable d'environnement :
# TMDB_API_KEY = [votre clé]
```

### 3. Variables d'environnement sur Vercel

Dans le dashboard Vercel → Settings → Environment Variables :

| Nom | Valeur |
|-----|--------|
| `TMDB_API_KEY` | Votre clé API TMDB |

### 4. Test local

```bash
# Créer .env.local avec votre clé
echo "TMDB_API_KEY=votre_cle_ici" > .env.local

npm run dev
# → http://localhost:3000
```

## 🛠 Stack Technique

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** — Styling
- **Zustand** — State management avec persistence
- **TMDB API** — Base de données films/séries

## 📁 Structure

```
cineai/
├── app/
│   ├── api/tmdb/route.ts    # API routes server-side
│   ├── globals.css          # Styles globaux
│   ├── layout.tsx
│   └── page.tsx             # Page principale + routing
├── components/
│   ├── Navbar.tsx           # Navigation
│   ├── HomeView.tsx         # Page d'accueil + tendances
│   ├── QuizView.tsx         # Test psychologique
│   ├── AnalysisView.tsx     # Analyse des goûts
│   ├── ResultsView.tsx      # Affichage recommandations
│   ├── MediaCard.tsx        # Carte film/série
│   └── LoadingScreen.tsx    # Écran de chargement
├── lib/
│   ├── tmdb.ts              # Client API TMDB
│   └── store.ts             # État global Zustand
└── vercel.json
```

## 🎨 Personnalisation

### Changer les couleurs
Dans `app/globals.css`, modifiez les variables CSS :
```css
:root {
  --accent: #e63946;   /* Rouge principal */
  --neon: #7b2fff;     /* Violet accent */
  --cyan: #06d6a0;     /* Vert pour les likes */
  --gold: #f4a261;     /* Or pour les scores */
}
```

### Ajouter des questions au quiz
Dans `components/QuizView.tsx`, éditez le tableau `QUIZ_STEPS`.

### Modifier les mappings genre→humeur
Dans `lib/tmdb.ts`, éditez `MOOD_TO_GENRES`.
