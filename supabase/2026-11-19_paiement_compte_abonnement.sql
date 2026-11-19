-- Parcours (19/11/2026) :
--   • heure d'accompagnement, comme l'heure d'installation ;
--   • étape « Devis payé » après « Signé » : payé, payé en plusieurs fois ou en attente
--     (chacun des trois fait avancer le dossier, pour ne pas bloquer la suite) ;
--   • étape « Compte créé » après « Groupe SAV créé » ;
--   • prix de l'abonnement, dans une table à part lisible seulement par la direction et les admins.
-- Ajouts seulement : l'ancienne version de l'app continue de fonctionner avec ce schéma.

alter table public.dossiers
  add column heure_accompagnement time,
  add column paiement text check (paiement in ('paye', 'plusieurs_fois', 'en_attente')),
  add column paiement_le timestamptz,
  add column compte_cree boolean not null default false,
  add column compte_cree_le timestamptz;

-- Dates des étapes, posées par la base (comme les autres étapes cochées à la main)
create or replace function private.dossier_dates_etapes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.devis_fait_le := case when new.devis_fait then coalesce(new.devis_fait_le, now()) end;
    new.devis_accepte_le := case when new.devis_accepte then coalesce(new.devis_accepte_le, now()) end;
    new.signature_le := case when new.signature then coalesce(new.signature_le, now()) end;
    new.paiement_le := case when new.paiement is not null then coalesce(new.paiement_le, now()) end;
    new.groupe_sav_le := case when new.groupe_sav then coalesce(new.groupe_sav_le, now()) end;
    new.compte_cree_le := case when new.compte_cree then coalesce(new.compte_cree_le, now()) end;
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
    -- Payé, en plusieurs fois ou en attente : la date est celle du premier choix
    if (new.paiement is null) <> (old.paiement is null) then
      new.paiement_le := case when new.paiement is not null then now() end;
    end if;
    if new.groupe_sav is distinct from old.groupe_sav then
      new.groupe_sav_le := case when new.groupe_sav then now() end;
    end if;
    if new.compte_cree is distinct from old.compte_cree then
      new.compte_cree_le := case when new.compte_cree then now() end;
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

-- Prix de l'abonnement : direction et admins seulement (les commerciaux ne le voient pas)
create or replace function private.is_direction()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membres m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and m.role in ('directeur', 'admin')
  );
$$;
grant execute on function private.is_direction() to authenticated;

create table public.abonnements (
  dossier_id uuid primary key references public.dossiers (id) on delete cascade,
  -- Montant en euros par mois
  prix numeric(10, 2) not null check (prix >= 0 and prix < 100000),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.abonnements enable row level security;
create policy "abonnements lus par la direction" on public.abonnements
  for select to authenticated using ((select private.is_direction()));
create policy "abonnements ajoutés par la direction" on public.abonnements
  for insert to authenticated with check ((select private.is_direction()));
create policy "abonnements modifiés par la direction" on public.abonnements
  for update to authenticated using ((select private.is_direction())) with check ((select private.is_direction()));
create policy "abonnements supprimés par la direction" on public.abonnements
  for delete to authenticated using ((select private.is_direction()));

-- Historique du dossier : paiement, compte créé, heure d'accompagnement
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
    if new.paiement is distinct from old.paiement then
      lignes := lignes || (case new.paiement
        when 'paye' then 'a noté le devis payé'
        when 'plusieurs_fois' then 'a noté le devis payé en plusieurs fois'
        when 'en_attente' then 'a noté le paiement du devis en attente'
        else 'a retiré le paiement du devis' end)::text;
    end if;
    if new.groupe_sav is distinct from old.groupe_sav then
      lignes := lignes || (case when new.groupe_sav then 'a coché « Groupe SAV créé »' else 'a décoché « Groupe SAV créé »' end)::text;
    end if;
    if new.compte_cree is distinct from old.compte_cree then
      lignes := lignes || (case when new.compte_cree then 'a coché « Compte créé »' else 'a décoché « Compte créé »' end)::text;
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
    if (new.date_accompagnement, new.heure_accompagnement) is distinct from (old.date_accompagnement, old.heure_accompagnement) then
      lignes := lignes || (case when new.date_accompagnement is not null
        then 'a fixé l''accompagnement au ' || to_char(new.date_accompagnement, 'DD/MM/YYYY')
          || coalesce(' à ' || to_char(new.heure_accompagnement, 'HH24"h"MI'), '')
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
