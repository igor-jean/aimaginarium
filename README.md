# AImaginarum

Un jeu multijoueur créatif basé sur la génération d'images par IA où les joueurs s'affrontent pour reproduire au mieux l'image du maître.

## 🎮 Fonctionnalités

- 🎨 Génération d'images via IA
- 👥 Système de salons multijoueurs
- 💬 Chat en temps réel
- 🏆 Système de scores
- 🔐 Authentification des utilisateurs

## 🛠 Technologies

- **Frontend & Backend**: Next.js 14
- **Base de données**: Supabase
- **ORM**: Drizzle
- **Temps réel**: Supabase Realtime
- **Authentification**: Supabase Auth
- **Génération d'images**: OpenAI API
- **Styles**: TailwindCSS

## 🚀 Installation

1. Cloner le projet

```bash
git clone [URL_DU_REPO]
cd aimaginarium
```

2. Installer les dépendances

```bash
npm install
```

3. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Remplir les variables suivantes dans `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

4. Lancer le projet en développement

```bash
npm run dev
```

## 📝 Structure du projet

```
src/
├── app/                 # Routes et pages Next.js
├── components/          # Composants React réutilisables
├── lib/                 # Utilitaires et configurations
│   ├── supabase/       # Configuration Supabase
│   └── drizzle/        # Schémas et configurations Drizzle
├── types/              # Types TypeScript
└── utils/              # Fonctions utilitaires
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📜 Licence

MIT
