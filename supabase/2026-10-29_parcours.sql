-- Parcours daté, compte rendu de RDV, journal et objectifs (29/10/2026)
-- À exécuter une fois dans Supabase → SQL Editor, APRÈS 2026-10-29_agenda.sql.

-- ─── 1. Dossiers : date de chaque étape, perte, source, coordonnées, relance ───
alter table public.dossiers
  add column devis_fait_le timestamptz,
  add column devis_accepte_le timestamptz,
  add column signature_le timestamptz,
  add column enrolement_tpe_le timestamptz,
  add column perdu_le timestamptz,
  add column raison_perte text check (raison_perte in ('prix','deja_equipe','pas_le_moment','pas_interesse','autre')),
  add column source text check (source in ('terrain','recommandation','appel_entrant','salon','site_web','autre')),
  add column gerant text,
  add column telephone text,
  add column adresse text,
  add column activite text,
  add column relance_le date;

-- Étapes déjà cochées avant cette migration : on prend la dernière modification comme date
update public.dossiers set
  devis_fait_le = case when devis_fait then updated_at end,
  devis_accepte_le = case when devis_accepte then updated_at end,
  signature_le = case when signature then updated_at end,
  enrolement_tpe_le = case when enrolement_tpe then updated_at end;

-- La date d'une étape est posée par la base quand la case est cochée, effacée quand elle est décochée
create or replace function private.dossier_dates_etapes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.devis_fait_le := case when new.devis_fait then coalesce(new.devis_fait_le, now()) end;
    new.devis_accepte_le := case when new.devis_accepte then coalesce(new.devis_accepte_le, now()) end;
    new.signature_le := case when new.signature then coalesce(new.signature_le, now()) end;
    new.enrolement_tpe_le := case when new.enrolement_tpe then coalesce(new.enrolement_tpe_le, now()) end;
  else
    if new.devis_fait is distinct from old.devis_fait then
      new.devis_fait_le := case when new.devis_fait then now() end;
    end if;
    if new.devis_accepte is distinct from old.devis_accepte then
      new.devis_accepte_le := case when new.devis_accepte then now() end;
    end if;
    if new.signature is distinct from old.signature then
      new.signature_le := case when new.signature then now() end;
    end if;
    if new.enrolement_tpe is distinct from old.enrolement_tpe then
      new.enrolement_tpe_le := case when new.enrolement_tpe then now() end;
    end if;
  end if;
  return new;
end;
$$;

create trigger dossiers_dates_etapes before insert or update on public.dossiers
for each row execute function private.dossier_dates_etapes();

-- ─── 2. Rendez-vous : compte rendu ───
alter table public.rendez_vous
  add column resultat text check (resultat in ('positif','a_relancer','pas_interesse')),
  add column suite text check (suite in ('devis','nouveau_rdv','rien')),
  add column compte_rendu text,
  add column compte_rendu_le timestamptz;

-- ─── 3. Journal d'un dossier : notes de l'équipe + historique automatique ───
create table public.journal (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  auteur text not null,
  type text not null default 'note' check (type in ('note','historique','compte_rendu')),
  texte text not null check (length(trim(texte)) > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index journal_dossier_idx on public.journal (dossier_id, created_at desc);

-- Prénom du membre connecté (null pour la clé secrète)
create or replace function private.nom_membre()
returns text language sql stable security definer set search_path = ''
as $$
  select m.nom from public.membres m
  where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

-- L'auteur d'une ligne est toujours le membre connecté : il ne peut pas être choisi par l'app
create or replace function private.journal_auteur()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.auteur := coalesce(private.nom_membre(), new.auteur, 'Quelqu''un');
  return new;
end;
$$;

create trigger journal_auteur before insert on public.journal
for each row execute function private.journal_auteur();

alter table public.journal enable row level security;

create policy "lecture journal equipe" on public.journal
  for select to authenticated using ((select private.is_membre()));
create policy "ajout note equipe" on public.journal
  for insert to authenticated
  with check ((select private.is_membre()) and type = 'note' and created_by = (select auth.uid()));
create policy "suppression de ses notes" on public.journal
  for delete to authenticated using (type = 'note' and created_by = (select auth.uid()));

alter publication supabase_realtime add table public.journal;

-- Historique automatique : création, étapes cochées ou décochées, perte, réouverture, changement de commercial
create or replace function private.dossier_historique()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  qui text := private.nom_membre();
  lignes text[] := '{}';
  ligne text;
begin
  if tg_op = 'INSERT' then
    lignes := array['a créé le dossier'];
  else
    if new.devis_fait is distinct from old.devis_fait then
      lignes := lignes || (case when new.devis_fait then 'a coché « Devis envoyé »' else 'a décoché « Devis envoyé »' end)::text;
    end if;
    if new.devis_accepte is distinct from old.devis_accepte then
      lignes := lignes || (case when new.devis_accepte then 'a coché « Devis accepté »' else 'a décoché « Devis accepté »' end)::text;
    end if;
    if new.signature is distinct from old.signature then
      lignes := lignes || (case when new.signature then 'a coché « Signé »' else 'a décoché « Signé »' end)::text;
    end if;
    if new.enrolement_tpe is distinct from old.enrolement_tpe then
      lignes := lignes || (case when new.enrolement_tpe then 'a coché « TPE enrôlé »' else 'a décoché « TPE enrôlé »' end)::text;
    end if;
    if (new.date_installation is null) <> (old.date_installation is null) then
      lignes := lignes || (case when new.date_installation is not null then 'a coché « Installé »' else 'a décoché « Installé »' end)::text;
    end if;
    if new.perdu_le is not null and old.perdu_le is null then
      lignes := lignes || ('a classé le dossier perdu : ' || case new.raison_perte
        when 'prix' then 'prix trop élevé'
        when 'deja_equipe' then 'déjà sous contrat'
        when 'pas_le_moment' then 'pas le bon moment'
        when 'pas_interesse' then 'pas intéressé'
        else 'autre raison' end)::text;
    elsif new.perdu_le is null and old.perdu_le is not null then
      lignes := lignes || 'a rouvert le dossier'::text;
    end if;
    -- Un renommage depuis Paramètres passe par la clé secrète (qui = null) : pas de ligne
    if new.commercial is distinct from old.commercial and qui is not null then
      lignes := lignes || ('a confié le dossier à ' || new.commercial)::text;
    end if;
  end if;

  foreach ligne in array lignes loop
    insert into public.journal (dossier_id, auteur, type, texte)
    values (new.id, coalesce(qui, 'Quelqu''un'), 'historique', ligne);
  end loop;
  return null;
end;
$$;

create trigger dossiers_historique after insert or update on public.dossiers
for each row execute function private.dossier_historique();

-- Un compte rendu de RDV rattaché à un dossier apparaît aussi dans son journal
create or replace function private.rdv_compte_rendu_journal()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.dossier_id is not null and new.compte_rendu_le is not null
     and new.compte_rendu_le is distinct from old.compte_rendu_le then
    insert into public.journal (dossier_id, auteur, type, texte)
    values (
      new.dossier_id,
      coalesce(private.nom_membre(), new.commercial),
      'compte_rendu',
      'RDV du ' || to_char(new.jour, 'DD/MM') || ' : ' ||
        case new.resultat when 'positif' then 'positif' when 'a_relancer' then 'à relancer' else 'pas intéressé' end ||
        coalesce('. ' || nullif(trim(new.compte_rendu), ''), '')
    );
  end if;
  return null;
end;
$$;

create trigger rendez_vous_compte_rendu after update on public.rendez_vous
for each row execute function private.rdv_compte_rendu_journal();

-- ─── 4. Objectifs mensuels de signatures, par commercial ───
create table public.objectifs (
  commercial text not null,
  mois date not null check (mois = date_trunc('month', mois)::date),
  signatures integer not null check (signatures between 0 and 999),
  updated_at timestamptz not null default now(),
  primary key (commercial, mois)
);

alter table public.objectifs enable row level security;

-- Lecture pour l'équipe ; écriture seulement par l'espace Administration (clé secrète)
create policy "lecture objectifs equipe" on public.objectifs
  for select to authenticated using ((select private.is_membre()));
