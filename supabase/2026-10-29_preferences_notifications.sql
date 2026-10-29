-- Choix des notifications de chaque membre (29/10/2026)
-- À exécuter une fois dans Supabase → SQL Editor, APRÈS 2026-10-29_notifications.sql.
-- null : choix par défaut du rôle (voir src/lib/notifications.ts). Modifié depuis Paramètres, par le serveur.
alter table public.membres add column notifications text[];
