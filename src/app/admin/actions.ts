"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export type ActionResult =
  | { ok: true; message: string; accountCreated?: boolean }
  | { ok: false; error: string };

const ROLES: Role[] = ["commercial", "directeur", "admin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function run(
  fn: () => Promise<string | { message: string; accountCreated: boolean }>,
): Promise<ActionResult> {
  try {
    const out = await fn();
    refresh();
    return typeof out === "string" ? { ok: true, message: out } : { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." };
  }
}

/** Trouve un compte de connexion par email (parcourt les pages d'utilisateurs). */
async function findAuthUser(email: string) {
  const admin = createAdminClient();
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function adminCount() {
  const { count, error } = await createAdminClient()
    .from("membres")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Crée le compte de connexion (s'il n'existe pas) et l'ajoute à l'équipe. */
export async function addMembre(input: {
  nom: string;
  email: string;
  role: Role;
  password: string;
}): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const nom = input.nom.trim();
    const email = input.email.trim().toLowerCase();
    if (!nom) throw new Error("Indique le prénom.");
    if (!EMAIL_RE.test(email)) throw new Error("Adresse email invalide.");
    if (!ROLES.includes(input.role)) throw new Error("Rôle invalide.");

    const admin = createAdminClient();
    const { data: existing } = await admin.from("membres").select("id").ilike("email", email).maybeSingle();
    if (existing) throw new Error("Cette personne fait déjà partie de l'équipe.");

    let created = false;
    if (!(await findAuthUser(email))) {
      if (input.password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
      const { error } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { nom },
      });
      if (error) throw new Error(error.message);
      created = true;
    }

    const { error } = await admin.from("membres").insert({ nom, email, role: input.role });
    if (error) throw new Error(error.message);

    return {
      accountCreated: created,
      message: created
        ? `${nom} est ajouté(e). Transmets-lui son email et son mot de passe provisoire.`
        : `${nom} avait déjà un compte : il (elle) est maintenant dans l'équipe.`,
    };
  });
}

export async function updateRole(membreId: string, role: Role): Promise<ActionResult> {
  return run(async () => {
    const me = await requireAdmin();
    if (!ROLES.includes(role)) throw new Error("Rôle invalide.");
    if (membreId === me.id && role !== "admin" && (await adminCount()) <= 1) {
      throw new Error("Tu es le seul admin : nomme un autre admin avant de changer ton rôle.");
    }
    const { error } = await createAdminClient().from("membres").update({ role }).eq("id", membreId);
    if (error) throw new Error(error.message);
    return "Rôle mis à jour.";
  });
}

export async function resetPassword(email: string, password: string): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
    const user = await findAuthUser(email);
    if (!user) throw new Error("Aucun compte de connexion pour cet email.");
    const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password });
    if (error) throw new Error(error.message);
    return "Nouveau mot de passe enregistré. Transmets-le à la personne.";
  });
}

/** Retire la personne de l'équipe et supprime son compte de connexion. Ses dossiers sont conservés. */
export async function deleteMembre(membreId: string): Promise<ActionResult> {
  return run(async () => {
    const me = await requireAdmin();
    if (membreId === me.id) throw new Error("Tu ne peux pas supprimer ton propre compte.");

    const admin = createAdminClient();
    const { data: membre, error: readError } = await admin
      .from("membres")
      .select("*")
      .eq("id", membreId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!membre) throw new Error("Membre introuvable.");

    const { error } = await admin.from("membres").delete().eq("id", membreId);
    if (error) throw new Error(error.message);

    const user = await findAuthUser(membre.email);
    if (user) {
      const { error: delError } = await admin.auth.admin.deleteUser(user.id);
      if (delError) throw new Error(`Retiré de l'équipe, mais compte non supprimé : ${delError.message}`);
    }
    return `${membre.nom} a été supprimé(e). Ses dossiers sont conservés.`;
  });
}
