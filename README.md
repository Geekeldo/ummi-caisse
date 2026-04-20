# UMMI — Gestion de Caisse

Application de gestion complète pour le restaurant UMMI.  
Next.js 15 + Supabase + Tailwind CSS — déployable sur Vercel.

## Architecture

```
ummi/
├── app/                    # Pages (App Router)
│   ├── login/              # Authentification
│   ├── dashboard/          # Tableau de bord mensuel
│   ├── daily/              # Saisie journalière (coeur du système)
│   ├── employees/          # Employés & avances
│   ├── suppliers/          # Fournisseurs (CRUD complet)
│   ├── safe/               # Coffre fort & charges fixes
│   ├── inventory/          # Stock & inventaire journalier
│   └── admin/              # Gestion utilisateurs & rôles
├── components/
│   ├── layout/             # App shell, sidebar
│   └── ui/                 # Composants réutilisables
├── hooks/                  # React hooks (auth, etc.)
├── lib/
│   ├── supabase/           # Client browser + server
│   ├── business.ts         # Logique métier (caisse, stats)
│   ├── permissions.ts      # Système de permissions
│   └── utils.ts            # Utilitaires
├── types/                  # TypeScript types
└── supabase/migrations/    # Schema SQL
```

## Installation

### 1. Cloner et installer

```bash
git clone <repo>
cd ummi
npm install
```

### 2. Configurer Supabase

1. Créer un NOUVEAU projet sur [supabase.com](https://supabase.com)
2. Aller dans SQL Editor et exécuter **UNE SEULE fois** :
   - `supabase/migrations/000_ummi_init.sql`

   Ce fichier consolidé crée tout le schéma, les données de départ **et** l'utilisateur super admin `salah@ummi.ma` / `Azerty1234@@`.

3. Copier `.env.local.example` → `.env.local` et remplir avec les clés du nouveau projet Supabase :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

4. Dans Supabase Dashboard → Storage, vérifier que le bucket **`brand`** est bien créé (la migration le fait automatiquement).

### 3. Lancer

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) et se connecter avec `salah@ummi.ma` / `Azerty1234@@`.

> **Important** : changer le mot de passe via l'interface admin après la première connexion.

## Déploiement Vercel

1. Push le code sur GitHub (nouveau repo)
2. Importer le repo dans [vercel.com](https://vercel.com) comme **nouveau projet**
3. Ajouter les variables d'environnement (Settings → Environment Variables) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

## Stack technique

- **Next.js 15** — App Router, Server Components
- **Supabase** — Auth, PostgreSQL, Row Level Security
- **Tailwind CSS** — Design system UMMI (DM Sans / DM Mono)
- **Recharts** — Graphiques
- **Lucide React** — Icônes
- **TypeScript** — Typage strict
- **Zod** — Validation

## Design

Palette **UMMI** tirée du logo :
- Teal profond `#3F5E5A` (corps du logo)
- Or / beige `#B8956A` (cadre du logo)
- Base sombre `#1D2D2B` pour sidebar et écrans d'auth
