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
- Espace **Administration** (rôle admin) : créer, supprimer des comptes, changer les rôles, générer un nouveau mot de passe

## Lancer en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Puis ouvrir http://localhost:3000.

Pour l'espace Administration, compléter `SUPABASE_SECRET_KEY` dans `.env.local` :
Supabase → **Project Settings → API Keys → Secret keys** → copier la clé `sb_secret_…`.
Cette clé donne tous les droits sur la base : elle ne doit jamais être committée ni partagée.

## Déployer sur Vercel

1. Sur vercel.com : **Add New → Project**, importer ce dépôt.
2. Dans **Environment Variables**, ajouter les trois variables de `.env.example` :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (la clé secrète, pour l'espace Administration)
3. Cliquer sur **Deploy**.

Ensuite, dans Supabase (projet ProjetMCommercial) → **Authentication → URL Configuration** :
- **Site URL** : l'adresse Vercel, par exemple `https://mcommercial.vercel.app`
- **Redirect URLs** : ajouter `https://mcommercial.vercel.app/auth/callback`

Sans cette étape, le lien « Mot de passe oublié » ne ramène pas vers l'app.

## Gérer les comptes

Un admin ouvre le menu (rond en haut à droite) → **Administration**. Il peut y :
- **ajouter un compte** : prénom, email, rôle et mot de passe provisoire (généré automatiquement), puis copier le message à envoyer à la personne ;
- **changer le rôle** : commercial, directeur ou admin ;
- **générer un nouveau mot de passe** ;
- **supprimer un compte** : la personne ne peut plus se connecter, ses dossiers sont conservés.

Seuls les membres de rôle **commercial** apparaissent dans les filtres et le formulaire des dossiers.

Le tout premier admin s'ajoute une seule fois à la main (Supabase → **SQL Editor**), après avoir créé son compte dans **Authentication → Users** :

```sql
insert into public.membres (email, nom, role) values ('ton@email.fr', 'Ton prénom', 'admin');
```

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
    admin/                espace Administration (page + actions serveur sécurisées)
    manifest.ts           manifest PWA
  components/             Dashboard, Kpis, Board, DossierCard, DossierSheet…
  lib/                    clients Supabase (dont le client admin, serveur uniquement), types, calculs
  proxy.ts                protège les pages et rafraîchit la session
public/
  sw.js                   service worker (installation et cache des fichiers statiques)
  icons/                  icônes de l'app
```
