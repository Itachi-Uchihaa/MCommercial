-- Dossiers (30/10/2026) : le champ siret accepte aussi un SIREN (9 chiffres), en plus du SIRET (14 chiffres).
-- Contrainte élargie seulement : l'ancienne version de l'app continue de fonctionner avec ce schéma.

alter table public.dossiers
  drop constraint dossiers_siret_check,
  add constraint dossiers_siret_check check (siret is null or siret ~ '^([0-9]{9}|[0-9]{14})$');
