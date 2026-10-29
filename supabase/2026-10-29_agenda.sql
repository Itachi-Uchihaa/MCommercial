-- Agenda des commerciaux (29/10/2026)
-- À exécuter une fois dans Supabase → SQL Editor, sur le projet ProjetMCommercial.

-- Plusieurs rendez-vous par dossier, ou sans dossier (prospect pas encore saisi)
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

create trigger rendez_vous_updated_at before update on public.rendez_vous
for each row execute function private.touch_updated_at();

alter table public.rendez_vous enable row level security;

create policy "lecture rdv equipe" on public.rendez_vous
  for select to authenticated using ((select private.is_membre()));
create policy "ajout rdv equipe" on public.rendez_vous
  for insert to authenticated with check ((select private.is_membre()));
create policy "modif rdv equipe" on public.rendez_vous
  for update to authenticated using ((select private.is_membre())) with check ((select private.is_membre()));
create policy "suppression rdv equipe" on public.rendez_vous
  for delete to authenticated using ((select private.is_membre()));

alter publication supabase_realtime add table public.rendez_vous;

-- La date de RDV unique du dossier est remplacée par l'agenda
alter table public.dossiers drop column date_rdv;
