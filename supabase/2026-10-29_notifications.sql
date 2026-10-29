-- Notifications push (29/10/2026)
-- À exécuter une fois dans Supabase → SQL Editor, APRÈS 2026-10-29_parcours.sql.

-- Un appareil (téléphone, navigateur) abonné aux notifications d'un membre
create table public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  appareil text,
  created_at timestamptz not null default now()
);

create index push_abonnements_email_idx on public.push_abonnements (email);

alter table public.push_abonnements enable row level security;

-- Chacun voit ses propres appareils ; les ajouts, suppressions et envois passent par le serveur (clé secrète)
create policy "ses abonnements" on public.push_abonnements
  for select to authenticated using (user_id = (select auth.uid()));
