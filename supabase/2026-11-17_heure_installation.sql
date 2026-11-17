-- Heure d'installation (17/11/2026) : en plus du jour, le commercial peut fixer l'heure.
-- Ajout seulement : l'ancienne version de l'app continue de fonctionner avec ce schéma.
-- Heure de Paris sans fuseau (`time`), comme les heures des RDV.

alter table public.dossiers
  add column heure_installation time;

-- Historique du dossier : « a fixé l'installation au 20/11/2026 à 14h30 »
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
    if (new.devis_ipad, new.devis_imprimante_saga, new.devis_imprimante_epson, new.devis_tiroir_caisse, new.devis_monnayeur,
        new.devis_tpe_smile, new.devis_tpe_mpay, new.devis_tpe_borne, new.devis_borne,
        new.devis_qr_menu, new.devis_qr_borne, new.devis_qr_commande)
       is distinct from (old.devis_ipad, old.devis_imprimante_saga, old.devis_imprimante_epson, old.devis_tiroir_caisse, old.devis_monnayeur,
        old.devis_tpe_smile, old.devis_tpe_mpay, old.devis_tpe_borne, old.devis_borne,
        old.devis_qr_menu, old.devis_qr_borne, old.devis_qr_commande) then
      lignes := lignes || ('a mis à jour les équipements du devis : ' || coalesce(nullif(concat_ws(', ',
        case when new.devis_ipad > 0 then new.devis_ipad || ' iPad' end,
        case when new.devis_imprimante_saga > 0 then new.devis_imprimante_saga || ' imprimante' || case when new.devis_imprimante_saga > 1 then 's' else '' end || ' Saga' end,
        case when new.devis_imprimante_epson > 0 then new.devis_imprimante_epson || ' imprimante' || case when new.devis_imprimante_epson > 1 then 's' else '' end || ' Epson' end,
        case when new.devis_tiroir_caisse > 0 then new.devis_tiroir_caisse || ' tiroir' || case when new.devis_tiroir_caisse > 1 then 's' else '' end || ' caisse' end,
        case when new.devis_monnayeur > 0 then new.devis_monnayeur || ' monnayeur' || case when new.devis_monnayeur > 1 then 's' else '' end end,
        case when new.devis_tpe_smile > 0 then new.devis_tpe_smile || ' TPE Smile' end,
        case when new.devis_tpe_mpay > 0 then new.devis_tpe_mpay || ' TPE MPay' end,
        case when new.devis_tpe_borne > 0 then new.devis_tpe_borne || ' TPE borne' end,
        case when new.devis_borne > 0 then new.devis_borne || ' borne' || case when new.devis_borne > 1 then 's' else '' end end,
        case when new.devis_qr_menu > 0 then new.devis_qr_menu || ' QR code' || case when new.devis_qr_menu > 1 then 's' else '' end || ' menu' end,
        case when new.devis_qr_borne > 0 then new.devis_qr_borne || ' QR borne' end,
        case when new.devis_qr_commande > 0 then new.devis_qr_commande || ' QR prise de commande' end
      ), ''), 'aucun'))::text;
    end if;
    if (new.date_installation, new.heure_installation) is distinct from (old.date_installation, old.heure_installation) then
      lignes := lignes || (case when new.date_installation is not null
        then 'a fixé l''installation au ' || to_char(new.date_installation, 'DD/MM/YYYY')
          || coalesce(' à ' || to_char(new.heure_installation, 'HH24"h"MI'), '')
        else 'a retiré la date d''installation' end)::text;
    end if;
    if new.date_accompagnement is distinct from old.date_accompagnement then
      lignes := lignes || (case when new.date_accompagnement is not null
        then 'a fixé l''accompagnement au ' || to_char(new.date_accompagnement, 'DD/MM/YYYY')
        else 'a retiré la date d''accompagnement' end)::text;
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
