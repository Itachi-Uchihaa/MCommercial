-- Menu du restaurant (photos ou PDF), facultatif, ajouté à l'étape « Groupe SAV créé » (29/10/2026).
-- Fichiers dans un espace de stockage privé : seuls les membres connectés les voient (liens signés d'une heure).

-- ─── 1. Espace de stockage « menus » : privé, 15 Mo par fichier, photos et PDF ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menus', 'menus', false, 15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);

-- ─── 2. Liste des fichiers de chaque dossier ───
create table public.menu_fichiers (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  -- Chemin dans l'espace « menus » : <id du dossier>/<fichier>
  chemin text not null unique,
  nom text not null,
  type text not null,
  taille integer not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index menu_fichiers_dossier_idx on public.menu_fichiers (dossier_id, created_at);

alter table public.menu_fichiers enable row level security;

create policy "lecture menus equipe" on public.menu_fichiers
  for select to authenticated using ((select private.is_membre()));
create policy "ajout menus equipe" on public.menu_fichiers
  for insert to authenticated with check ((select private.is_membre()) and created_by = (select auth.uid()));
-- Mêmes droits que pour supprimer le dossier : son commercial, la direction, les admins
create policy "suppression menus" on public.menu_fichiers
  for delete to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and private.peut_supprimer_dossier(d.commercial)));

alter publication supabase_realtime add table public.menu_fichiers;

-- ─── 3. Droits sur les fichiers eux-mêmes ───
create policy "menus lecture equipe" on storage.objects
  for select to authenticated using (bucket_id = 'menus' and (select private.is_membre()));
create policy "menus ajout equipe" on storage.objects
  for insert to authenticated with check (bucket_id = 'menus' and (select private.is_membre()));
create policy "menus suppression" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menus'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1] and private.peut_supprimer_dossier(d.commercial)
    )
  );
