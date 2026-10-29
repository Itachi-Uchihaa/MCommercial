-- Suppression des dossiers : un commercial ne supprime que les siens,
-- la direction et les admins suppriment ceux de tout le monde (même règle que peutSupprimer, src/lib/dossiers.ts).

create or replace function private.peut_supprimer_dossier(commercial text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membres m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (m.role <> 'commercial' or m.nom = commercial)
  );
$$;

grant execute on function private.peut_supprimer_dossier(text) to authenticated;

alter policy "suppression dossiers equipe" on public.dossiers
  using ((select private.peut_supprimer_dossier(commercial)));
