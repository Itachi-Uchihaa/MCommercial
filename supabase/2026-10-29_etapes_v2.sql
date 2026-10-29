-- Nouveau parcours (29/10/2026) : RDV → Devis → Signature → Création du groupe SAV → Form → Enrôlement TPE.
-- « Devis accepté » et « Installé » ne sont plus des étapes : leurs colonnes restent, l'app ne les affiche plus.
-- Ajouts seulement : l'ancienne version de l'app continue de fonctionner avec ce schéma.

-- ─── 1. Nouvelles étapes ───
alter table public.dossiers
  add column groupe_sav boolean not null default false,
  add column groupe_sav_le timestamptz,
  add column form boolean not null default false,
  add column form_le timestamptz,
  -- Jour du premier RDV du dossier (tenu à jour par la base) : l'étape « RDV » est faite quand ce jour est arrivé
  add column rdv_le date;

-- ─── 2. Date posée par la base quand une case est cochée, effacée quand elle est décochée ───
create or replace function private.dossier_dates_etapes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.devis_fait_le := case when new.devis_fait then coalesce(new.devis_fait_le, now()) end;
    new.devis_accepte_le := case when new.devis_accepte then coalesce(new.devis_accepte_le, now()) end;
    new.signature_le := case when new.signature then coalesce(new.signature_le, now()) end;
    new.groupe_sav_le := case when new.groupe_sav then coalesce(new.groupe_sav_le, now()) end;
    new.form_le := case when new.form then coalesce(new.form_le, now()) end;
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
    if new.groupe_sav is distinct from old.groupe_sav then
      new.groupe_sav_le := case when new.groupe_sav then now() end;
    end if;
    if new.form is distinct from old.form then
      new.form_le := case when new.form then now() end;
    end if;
    if new.enrolement_tpe is distinct from old.enrolement_tpe then
      new.enrolement_tpe_le := case when new.enrolement_tpe then now() end;
    end if;
  end if;
  return new;
end;
$$;

-- ─── 3. Historique du dossier : les nouvelles étapes aussi ───
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
    if new.groupe_sav is distinct from old.groupe_sav then
      lignes := lignes || (case when new.groupe_sav then 'a coché « Groupe SAV créé »' else 'a décoché « Groupe SAV créé »' end)::text;
    end if;
    if new.form is distinct from old.form then
      lignes := lignes || (case when new.form then 'a coché « Form »' else 'a décoché « Form »' end)::text;
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

-- ─── 4. Étape « RDV » : jour du premier RDV, recalculé à chaque ajout, déplacement ou suppression de RDV ───
create or replace function private.dossier_premier_rdv()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.dossier_id is not null then
    update public.dossiers d set rdv_le = (select min(r.jour) from public.rendez_vous r where r.dossier_id = d.id)
    where d.id = old.dossier_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.dossier_id is not null then
    update public.dossiers d set rdv_le = (select min(r.jour) from public.rendez_vous r where r.dossier_id = d.id)
    where d.id = new.dossier_id;
  end if;
  return null;
end;
$$;

create trigger rendez_vous_premier_rdv after insert or update of dossier_id, jour or delete on public.rendez_vous
for each row execute function private.dossier_premier_rdv();

-- RDV déjà enregistrés
update public.dossiers d set rdv_le = (select min(r.jour) from public.rendez_vous r where r.dossier_id = d.id);
