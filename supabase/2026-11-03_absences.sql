-- Absences des commerciaux (alternants à l'école, congés…), affichées dans Présences et Équipe.
-- Un commercial pose et retire ses propres absences ; la direction et les admins, celles de tout le monde.
-- Une absence répétée (ex. école chaque lundi) est enregistrée en plusieurs lignes qui partagent `serie`.

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  commercial text not null check (length(trim(commercial)) > 0),
  debut date not null,
  fin date not null,
  motif text not null default 'ecole' check (motif in ('ecole','conges','autre')),
  note text,
  serie uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint absences_dates check (fin >= debut)
);

create index absences_periode_idx on public.absences (debut, fin);
create index absences_commercial_idx on public.absences (commercial, debut);
create index absences_serie_idx on public.absences (serie);

-- Même règle que peut_supprimer_dossier : soi-même, ou la direction et les admins pour tout le monde
create or replace function private.peut_gerer_absence(commercial text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membres m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (m.role <> 'commercial' or m.nom = commercial)
  );
$$;

grant execute on function private.peut_gerer_absence(text) to authenticated;

alter table public.absences enable row level security;

create policy "lecture absences equipe" on public.absences
  for select to authenticated using ((select private.is_membre()));
create policy "ajout absences" on public.absences
  for insert to authenticated with check ((select private.peut_gerer_absence(commercial)));
create policy "modif absences" on public.absences
  for update to authenticated
  using ((select private.peut_gerer_absence(commercial)))
  with check ((select private.peut_gerer_absence(commercial)));
create policy "suppression absences" on public.absences
  for delete to authenticated using ((select private.peut_gerer_absence(commercial)));

alter publication supabase_realtime add table public.absences;
