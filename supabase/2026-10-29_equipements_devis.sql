-- Équipements du devis (29/10/2026) : quantité d'iPad, d'imprimantes, de tiroirs caisse, de TPE et de bornes.
-- Ajouts seulement : l'ancienne version de l'app continue de fonctionner avec ce schéma.

alter table public.dossiers
  add column devis_ipad smallint not null default 0 check (devis_ipad between 0 and 99),
  add column devis_imprimante smallint not null default 0 check (devis_imprimante between 0 and 99),
  add column devis_tiroir_caisse smallint not null default 0 check (devis_tiroir_caisse between 0 and 99),
  add column devis_tpe smallint not null default 0 check (devis_tpe between 0 and 99),
  add column devis_borne smallint not null default 0 check (devis_borne between 0 and 99);

-- Historique du dossier : une ligne quand les équipements du devis changent
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
    if (new.devis_ipad, new.devis_imprimante, new.devis_tiroir_caisse, new.devis_tpe, new.devis_borne)
       is distinct from (old.devis_ipad, old.devis_imprimante, old.devis_tiroir_caisse, old.devis_tpe, old.devis_borne) then
      lignes := lignes || ('a mis à jour les équipements du devis : ' || coalesce(nullif(concat_ws(', ',
        case when new.devis_ipad > 0 then new.devis_ipad || ' iPad' end,
        case when new.devis_imprimante > 0 then new.devis_imprimante || ' imprimante' || case when new.devis_imprimante > 1 then 's' else '' end end,
        case when new.devis_tiroir_caisse > 0 then new.devis_tiroir_caisse || ' tiroir' || case when new.devis_tiroir_caisse > 1 then 's' else '' end || ' caisse' end,
        case when new.devis_tpe > 0 then new.devis_tpe || ' TPE' end,
        case when new.devis_borne > 0 then new.devis_borne || ' borne' || case when new.devis_borne > 1 then 's' else '' end end
      ), ''), 'aucun'))::text;
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
