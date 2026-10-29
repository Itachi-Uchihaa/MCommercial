# mcaisse · Suivi commercial

Application mobile (PWA) de suivi des dossiers commerciaux mcaisse : RDV, devis, signature, enrôlement TPE et installation, partagés en direct avec toute l'équipe.

**Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (base, connexion, temps réel) · hébergement Vercel.

## Fonctionnalités

Onglets en bas sur téléphone, menu latéral sur ordinateur. Tout se met à jour en direct entre les téléphones de l'équipe.

- **Aujourd'hui** (accueil) : objectif du mois, prochain RDV (itinéraire, appel, fiche), RDV du jour, « À relancer ». Un commercial voit sa journée, le directeur celle de l'équipe.
- **Dossiers** : pipeline par étape (prospects, devis, acceptés, signés, TPE, installés, perdus), recherche, filtre par commercial. Chaque carte montre l'avancement, la dernière étape datée et le prochain RDV.
- **Clients** : carnet de tous les restaurants suivis, de A à Z, avec leur statut (client signé, en cours, perdu), recherche (nom, gérant, ville, téléphone…) et raccourcis pour appeler, écrire ou lancer l'itinéraire.
- **Fiche client** : parcours daté (la date de chaque étape est posée par la base), bouton « étape suivante », « Classer perdu » avec la raison, RDV avec compte rendu, journal (notes de l'équipe et historique automatique), infos.
- **Nouveau dossier** : recherche par nom ou SIRET dans l'annuaire officiel des entreprises (nom, adresse, gérant, activité remplis tout seuls), alerte si le restaurant est déjà suivi par un collègue, source du contact.
- **Agenda** : vue Semaine, ou vue Liste (tous les RDV à venir ou des 60 derniers jours, avec recherche) ; filtre par commercial, alerte si deux RDV se chevauchent, pas de RDV planifié dans le passé, compte rendu après chaque RDV (résultat, suite, jour de rappel).
- **Relances automatiques** : devis sans réponse depuis 7 jours, rappel posé dans un compte rendu, RDV sans compte rendu ; côté directeur, dossiers signés qui n'avancent plus depuis 10 jours.
- **Équipe** (directeur) : signés / objectif, taux de signature, délai moyen, parcours du RDV à l'installation, qui est sur le terrain aujourd'hui, à débloquer, chiffres par commercial, semaine de l'équipe, pourquoi on perd, d'où viennent les signatures, export CSV. Objectifs mensuels fixés par les administrateurs.
- **Notifications push** (gratuites, sans App Store), activées par chacun dans **Paramètres**, qui choisit aussi ce qui le prévient (`src/lib/notifications.ts`). Un commercial : RDV ajouté ou déplacé pour lui, récap du matin. La direction peut aussi suivre l'activité de l'équipe (nouveau dossier, nouveau RDV, compte rendu, chaque étape, dossier perdu), tout coché par défaut, jamais pour ses propres actions. Sur iPhone, l'app doit d'abord être ajoutée à l'écran d'accueil (iOS 16.4 ou plus).
- Connexion par email et mot de passe, réservée aux membres de l'équipe ; installable sur l'écran d'accueil (iPhone et Android).
- Espace **Administration** (admins et directeurs) : créer, supprimer des comptes, changer les rôles, générer un nouveau mot de passe. **Paramètres** : chacun change son prénom.

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
2. Dans **Environment Variables**, ajouter les variables de `.env.example` (mêmes valeurs que `.env.local`) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (la clé secrète, pour l'espace Administration, les objectifs et les notifications)
   - `ADMIN_EMAILS` (facultatif : emails qui ont accès à l'Administration en plus des admins et directeurs)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` (notifications push)
   - `CRON_SECRET` (récap du matin)
3. Cliquer sur **Deploy**.

`vercel.json` programme le récap du matin (`/api/cron/matin`) du lundi au samedi à 6 h 30 UTC, soit 7 h 30 en hiver et 8 h 30 en été. Sur l'offre gratuite de Vercel, l'heure peut varier d'une heure au plus.

Ensuite, dans Supabase (projet ProjetMCommercial) → **Authentication → URL Configuration** :
- **Site URL** : l'adresse Vercel, par exemple `https://mcommercial.vercel.app`
- **Redirect URLs** : ajouter `https://mcommercial.vercel.app/auth/callback`

Sans cette étape, le lien « Mot de passe oublié » ne ramène pas vers l'app.

## Gérer les comptes

L'espace **Administration** est ouvert aux rôles **admin** et **directeur**, plus les emails éventuellement listés dans `ADMIN_EMAILS`. Un directeur ne voit pas les comptes admin (ni dans la liste ni dans les compteurs, ni en base) et ne peut ni les modifier ni les supprimer. Ce qu'un admin fait (dossiers, RDV, notes) apparaît au nom de « l'équipe mcaisse » dans le journal et les notifications.

Une personne autorisée ouvre le menu (rond en haut à droite sur téléphone, menu de gauche sur ordinateur) → **Administration**. Elle peut y :
- **ajouter un compte** : prénom, email, rôle et mot de passe provisoire (généré automatiquement), puis copier le message à envoyer à la personne ;
- **changer le rôle** : commercial ou directeur ;
- **générer un nouveau mot de passe** ;
- **supprimer un compte** : la personne ne peut plus se connecter, ses dossiers sont conservés.

Seuls les membres de rôle **commercial** apparaissent dans les filtres et le formulaire des dossiers.

La toute première personne s'ajoute une seule fois à la main (Supabase → **SQL Editor**), après avoir créé son compte dans **Authentication → Users** :

```sql
insert into public.membres (email, nom, role) values ('ton@email.fr', 'Ton prénom', 'directeur');
```

Le rôle `admin` ne s'attribue pas depuis l'app (seulement en base) : il protège les comptes qu'un directeur ne doit pas toucher.

## Base de données

Le schéma de départ est dans `supabase/schema.sql` (tables `membres`, `dossiers` et `rendez_vous`, règles d'accès RLS, temps réel). Pour recréer la base ailleurs : ce fichier, puis les fichiers datés plus récents que l'agenda, dans l'ordre.

Les évolutions se font par des fichiers datés dans `supabase/`, à exécuter une fois dans Supabase → **SQL Editor**, **avant** de mettre en ligne le code qui en a besoin :

| Fichier | Contenu |
|---|---|
| `2026-10-29_agenda.sql` | Table `rendez_vous` (agenda) et suppression de `dossiers.date_rdv` |
| `2026-10-29_parcours.sql` | Dates des étapes (posées par la base), perte et raison, source, coordonnées, jour de relance ; compte rendu des RDV ; table `journal` avec historique automatique ; table `objectifs` |
| `2026-10-29_notifications.sql` | Table `push_abonnements` (appareils abonnés aux notifications) |
| `2026-10-29_preferences_notifications.sql` | Colonne `membres.notifications` (notifications choisies dans Paramètres) |
| `2026-10-29_admins_caches.sql` | Comptes admin lisibles seulement par les admins ; ce qu'un admin fait est signé « Équipe mcaisse » dans le journal |

Les heures des RDV sont enregistrées sans fuseau (`time`) : ce sont des heures de Paris, saisies et affichées telles quelles.

Les heures des RDV sont enregistrées sans fuseau (`time`) : ce sont des heures de Paris, saisies et affichées telles quelles.

## Structure

```
src/
  app/
    page.tsx              Aujourd'hui (accueil ; « Accès non autorisé » pour un compte hors équipe)
    dossiers/             pipeline (?etape=&commercial=&q=), fiche [id], nouveau
    clients/              carnet des clients de A à Z (?statut=client|en_cours|perdu&q=)
    agenda/               agenda (?semaine=AAAA-MM-JJ, ?commercial=, ?dossier=<id> pour planifier un RDV)
    equipe/               pilotage de l'équipe (?periode=semaine|mois|trimestre)
    actions/              actions serveur : dossiers, compte rendu, objectifs (puis refresh de la page)
    api/entreprises/      recherche dans l'annuaire officiel des entreprises
    api/cron/matin/       récap du matin (Vercel Cron, protégé par CRON_SECRET)
    login/, reinitialiser/, auth/callback/   connexion et mot de passe
    admin/, parametres/   Administration (ADMIN_EMAILS) et prénom de chacun
    manifest.ts           manifest PWA
  components/             AppShell (onglets, menu latéral), BottomSheet, CompteRenduSheet, McaisseLogo, icons…
    aujourdhui/, dossiers/, clients/, agenda/, equipe/   écrans
  lib/
    session.ts            contexte commun des pages (membre connecté, équipe, jour et heure de Paris)
    dossiers.ts           étapes, dates d'étape, sources, raisons de perte
    relances.ts           règles « À relancer » / « À débloquer »
    stats.ts              chiffres de l'écran Équipe
    agenda.ts, dates.ts   semaines, dates et heures (calculées en UTC, à l'heure de Paris)
    useRealtimeRefresh.ts recharge la page quand un collègue modifie les données
    push.ts               envoi des notifications (web-push, clés VAPID)
  proxy.ts                protège les pages et rafraîchit la session
public/
  sw.js                   service worker (installation, cache des fichiers statiques, affichage des notifications)
  icons/                  icônes de l'app
```
