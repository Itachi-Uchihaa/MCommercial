-- Base du suivi commercial mcaisse (à exécuter une fois sur un projet Supabase vide)
-- Ce fichier inclut déjà 2026-10-29_agenda.sql. Sur une base neuve, exécuter ensuite
-- 2026-10-29_parcours.sql, puis les fichiers datés plus récents, dans l'ordre.
create schema if not exists private;

-- Liste blanche de l'équipe : seuls ces emails accèdent aux données
create table public.membres (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nom text not null,
  role text not null default 'commercial' check (role in ('commercial','directeur','admin')),
  created_at timestamptz not null default now()
);

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  commercial text not null,
  restaurant text not null check (length(trim(restaurant)) > 0),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  mail text,
  devis_fait boolean not null default false,
  devis_accepte boolean not null default false,
  signature boolean not null default false,
  enrolement_tpe boolean not null default false,
  date_installation date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dossiers_commercial_idx on public.dossiers (commercial);
create index dossiers_created_at_idx on public.dossiers (created_at desc);

-- Agenda : plusieurs rendez-vous par dossier, ou sans dossier (prospect pas encore saisi)
create table public.rendez_vous (
  id uuid primary key default gen_random_uuid(),
  commercial text not null,
  dossier_id uuid references public.dossiers(id) on delete set null,
  restaurant text not null check (length(trim(restaurant)) > 0),
  type text not null default 'decouverte'
    check (type in ('decouverte','demo','signature','installation','relance','autre')),
  jour date not null,
  debut time not null,
  fin time not null,
  adresse text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rendez_vous_horaires check (fin > debut)
);

create index rendez_vous_jour_idx on public.rendez_vous (jour, debut);
create index rendez_vous_commercial_jour_idx on public.rendez_vous (commercial, jour);
create index rendez_vous_dossier_idx on public.rendez_vous (dossier_id);

create or replace function private.is_membre()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membres m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_membre() to authenticated;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger dossiers_updated_at before update on public.dossiers
for each row execute function private.touch_updated_at();
create trigger rendez_vous_updated_at before update on public.rendez_vous
for each row execute function private.touch_updated_at();

alter table public.membres enable row level security;
alter table public.dossiers enable row level security;
alter table public.rendez_vous enable row level security;

create policy "membres visibles par l'equipe" on public.membres
  for select to authenticated using ((select private.is_membre()));
create policy "lecture dossiers equipe" on public.dossiers
  for select to authenticated using ((select private.is_membre()));
create policy "ajout dossiers equipe" on public.dossiers
  for insert to authenticated with check ((select private.is_membre()));
create policy "modif dossiers equipe" on public.dossiers
  for update to authenticated using ((select private.is_membre())) with check ((select private.is_membre()));
create policy "suppression dossiers equipe" on public.dossiers
  for delete to authenticated using ((select private.is_membre()));
create policy "lecture rdv equipe" on public.rendez_vous
  for select to authenticated using ((select private.is_membre()));
create policy "ajout rdv equipe" on public.rendez_vous
  for insert to authenticated with check ((select private.is_membre()));
create policy "modif rdv equipe" on public.rendez_vous
  for update to authenticated using ((select private.is_membre())) with check ((select private.is_membre()));
create policy "suppression rdv equipe" on public.rendez_vous
  for delete to authenticated using ((select private.is_membre()));

alter publication supabase_realtime add table public.dossiers;
alter publication supabase_realtime add table public.rendez_vous;
