# mcaisse · Suivi commercial

Application mobile (PWA) de suivi des dossiers commerciaux mcaisse : RDV, devis, signature, enrôlement TPE et installation, partagés en direct avec toute l'équipe.

**Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (base, connexion, temps réel) · hébergement Vercel.

## Fonctionnalités

- Tableau de bord : 6 compteurs et taux de passage d'une étape à l'autre
- Classement par commercial (dossiers, signés, installés)
- Filtres par commercial et recherche (restaurant, SIRET, mail)
- Étapes cochables d'un tap, synchronisées en direct entre tous les téléphones
- Ajout, modification et suppression de dossiers
- Connexion par email et mot de passe, réservée aux membres de l'équipe
- Installable sur l'écran d'accueil (iPhone et Android)

## Lancer en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Puis ouvrir http://localhost:3000.

## Déployer sur Vercel

1. Sur vercel.com : **Add New → Project**, importer ce dépôt.
2. Dans **Environment Variables**, ajouter les deux variables de `.env.example` :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Cliquer sur **Deploy**.

Ensuite, dans Supabase (projet ProjetMCommercial) → **Authentication → URL Configuration** :
- **Site URL** : l'adresse Vercel, par exemple `https://mcommercial.vercel.app`
- **Redirect URLs** : ajouter `https://mcommercial.vercel.app/auth/callback`

Sans cette étape, le lien « Mot de passe oublié » ne ramène pas vers l'app.

## Ajouter un membre de l'équipe

Il faut deux étapes, car un compte sans fiche membre voit « Accès non autorisé » :

1. Supabase → **Authentication → Users → Add user → Create new user** : email, mot de passe provisoire, cocher **Auto Confirm User**.
2. Supabase → **SQL Editor** :

```sql
insert into public.membres (email, nom, role)
values ('lamia@exemple.fr', 'Lamia', 'commercial');
-- role : 'commercial', 'directeur' ou 'admin'
```

Pour proposer un nouveau commercial dans les filtres et le formulaire, ajouter aussi son prénom dans `src/lib/config.ts`.

## Base de données

Le schéma complet est dans `supabase/schema.sql` (tables `membres` et `dossiers`, règles d'accès RLS, temps réel). Il est déjà appliqué sur ProjetMCommercial ; ce fichier sert à recréer la base ailleurs si besoin.

## Structure

```
src/
  app/
    page.tsx              tableau de bord (vérifie la session et l'appartenance à l'équipe)
    login/                connexion et « mot de passe oublié »
    reinitialiser/        choix d'un nouveau mot de passe
    auth/callback/        retour des liens email Supabase
    manifest.ts           manifest PWA
  components/             Dashboard, Kpis, Board, DossierCard, DossierSheet…
  lib/                    clients Supabase, types, calculs
  proxy.ts                protège les pages et rafraîchit la session
public/
  sw.js                   service worker (installation et cache des fichiers statiques)
  icons/                  icônes de l'app
```
