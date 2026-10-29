-- Comptes admin invisibles pour le reste de l'équipe (directeur compris).
-- 1. Un admin n'est lisible dans `membres` que par un admin (chacun lit toujours sa propre ligne).
-- 2. Ce qu'un admin fait est signé « Équipe mcaisse » dans le journal des dossiers (notes, historique, comptes rendus).

-- Le membre connecté est-il admin ? (security definer : lit `membres` sans repasser par ses règles)
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membres m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and m.role = 'admin'
  );
$$;

grant execute on function private.is_admin() to authenticated;

drop policy "membres visibles par l'equipe" on public.membres;
create policy "membres visibles par l'equipe" on public.membres
  for select to authenticated
  using (
    (select private.is_membre())
    and (role <> 'admin' or (select private.is_admin()) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );

-- Prénom du membre connecté, tel qu'il est signé dans le journal (null pour la clé secrète)
create or replace function private.nom_membre()
returns text language sql stable security definer set search_path = ''
as $$
  select case when m.role = 'admin' then 'Équipe mcaisse' else m.nom end
  from public.membres m
  where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

-- Lignes déjà écrites par un admin
update public.journal j
set auteur = 'Équipe mcaisse'
from public.membres m
where m.role = 'admin' and j.auteur = m.nom;
