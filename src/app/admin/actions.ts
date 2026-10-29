"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export type ActionResult =
  | { ok: true; message: string; accountCreated?: boolean }
  | { ok: false; error: string };

// Rôles attribuables depuis l'app. « admin » ne s'attribue qu'en base : il protège les comptes qu'un directeur ne touche pas.
const ROLES: Role[] = ["commercial", "directeur"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Erreur montrée telle quelle (validation, droits) ; toute autre erreur reste dans les logs. */
class Refus extends Error {}

async function run(
  echec: string,
  fn: () => Promise<string | { message: string; accountCreated: boolean }>,
): Promise<ActionResult> {
  try {
    const out = await fn();
    refresh();
    return typeof out === "string" ? { ok: true, message: out } : { ok: true, ...out };
  } catch (e) {
    if (e instanceof Refus) return { ok: false, error: e.message };
    console.error(echec, e);
    return { ok: false, error: `${echec} Réessaie dans un instant.` };
  }
}

/** Trouve un compte de connexion par e-mail (parcourt les pages d'utilisateurs). */
async function findAuthUser(email: string) {
  const admin = createAdminClient();
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Accès refusé (requireAdmin) : message montré tel quel. */
async function direction() {
  try {
    return await requireAdmin();
  } catch {
    throw new Refus("Action réservée à la direction.");
  }
}

/** Un directeur gère l'équipe, mais pas les comptes admin. */
function verifierCible(me: { role: Role }, cible: { role: Role } | null | undefined) {
  if (!cible) throw new Refus("Ce compte n’existe plus. Recharge la page.");
  if (cible.role === "admin" && me.role !== "admin") throw new Refus("Seul un admin peut modifier ce compte.");
}

/** Crée le compte de connexion (s'il n'existe pas) et l'ajoute à l'équipe. */
export async function addMembre(input: {
  nom: string;
  email: string;
  role: Role;
  password: string;
}): Promise<ActionResult> {
  return run("Le compte n’a pas pu être ajouté.", async () => {
    await direction();
    const nom = input.nom.trim();
    const email = input.email.trim().toLowerCase();
    if (!nom) throw new Refus("Indique le prénom.");
    if (!EMAIL_RE.test(email)) throw new Refus("Cette adresse e-mail n’est pas valide. Vérifie-la.");
    if (!ROLES.includes(input.role)) throw new Refus("Rôle inconnu. Recharge la page et réessaie.");

    const admin = createAdminClient();
    const { data: existing } = await admin.from("membres").select("id").ilike("email", email).maybeSingle();
    if (existing) throw new Refus("Cette personne fait déjà partie de l’équipe.");

    let created = false;
    if (!(await findAuthUser(email))) {
      if (input.password.length < 8) throw new Refus("Le mot de passe doit faire au moins 8 caractères.");
      const { error } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { nom },
      });
      if (error) throw error;
      created = true;
    }

    const { error } = await admin.from("membres").insert({ nom, email, role: input.role });
    if (error) throw error;

    return {
      accountCreated: created,
      message: created
        ? `${nom} fait partie de l’équipe. Transmets-lui ses identifiants ci-dessous.`
        : `${nom} avait déjà un compte et fait maintenant partie de l’équipe.`,
    };
  });
}

export async function updateRole(membreId: string, role: Role): Promise<ActionResult> {
  return run("Le rôle n’a pas pu être enregistré.", async () => {
    const me = await direction();
    if (!ROLES.includes(role)) throw new Refus("Rôle inconnu. Recharge la page et réessaie.");
    const { data: cible } = await createAdminClient().from("membres").select("role").eq("id", membreId).maybeSingle();
    verifierCible(me, cible);
    const { error } = await createAdminClient().from("membres").update({ role }).eq("id", membreId);
    if (error) throw error;
    return "Rôle mis à jour";
  });
}

export async function resetPassword(email: string, password: string): Promise<ActionResult> {
  return run("Le mot de passe n’a pas pu être changé.", async () => {
    const me = await direction();
    if (password.length < 8) throw new Refus("Le mot de passe doit faire au moins 8 caractères.");
    const { data: cible } = await createAdminClient().from("membres").select("role").ilike("email", email).maybeSingle();
    verifierCible(me, cible);
    const user = await findAuthUser(email);
    if (!user) throw new Refus("Aucun compte de connexion pour cet e-mail.");
    const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password });
    if (error) throw error;
    return "Nouveau mot de passe enregistré. Transmets-le à la personne.";
  });
}

/** Retire la personne de l'équipe et supprime son compte de connexion. Ses dossiers sont conservés. */
export async function deleteMembre(membreId: string): Promise<ActionResult> {
  return run("Le compte n’a pas pu être supprimé.", async () => {
    const me = await direction();
    if (membreId === me.id) throw new Refus("Tu ne peux pas supprimer ton propre compte.");

    const admin = createAdminClient();
    const { data: membre, error: readError } = await admin.from("membres").select("*").eq("id", membreId).maybeSingle();
    if (readError) throw readError;
    verifierCible(me, membre);

    const { error } = await admin.from("membres").delete().eq("id", membreId);
    if (error) throw error;

    // Hors de l'équipe, la personne n'a déjà plus accès : un compte de connexion restant n'est qu'un détail technique
    const user = await findAuthUser(membre.email);
    if (user) {
      const { error: delError } = await admin.auth.admin.deleteUser(user.id);
      if (delError) console.error("Compte de connexion non supprimé", delError);
    }
    return `Compte de ${membre.nom} supprimé. Ses dossiers sont conservés.`;
  });
}
