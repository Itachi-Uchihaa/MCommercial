import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPanel, type MembreRow } from "@/components/admin/AdminPanel";
import { AuthCard } from "@/components/AuthCard";
import { getCurrentMembre, isAdminEmail } from "@/lib/auth";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import type { Membre } from "@/lib/types";

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-muted">Chargement…</main>}>
      <Contenu />
    </Suspense>
  );
}

async function Contenu() {
  const { email, me } = await getCurrentMembre();
  if (!email) redirect("/login");
  if (!me || !isAdminEmail(me.email)) redirect("/");

  if (!hasAdminKey()) {
    return (
      <AuthCard
        title="Clé admin manquante"
        subtitle="Pour gérer les comptes, ajoute la variable SUPABASE_SECRET_KEY (clé secrète Supabase) dans .env.local et dans Vercel, puis redémarre l'app."
      >
        <Link href="/" className="block w-full rounded-2xl bg-brand py-4 text-center font-bold text-white">
          Retour aux dossiers
        </Link>
      </AuthCard>
    );
  }

  const admin = createAdminClient();
  const [{ data: membres }, { data: users }, { data: dossiers }] = await Promise.all([
    admin.from("membres").select("*").order("nom").returns<Membre[]>(),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("dossiers").select("commercial"),
  ]);

  const byEmail = new Map((users?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));
  const nbDossiers = new Map<string, number>();
  (dossiers ?? []).forEach((d) => nbDossiers.set(d.commercial, (nbDossiers.get(d.commercial) ?? 0) + 1));

  const rows: MembreRow[] = (membres ?? []).map((m) => {
    const u = byEmail.get(m.email.toLowerCase());
    return {
      ...m,
      hasAccount: !!u,
      lastSignIn: u?.last_sign_in_at ?? null,
      dossiers: nbDossiers.get(m.nom) ?? 0,
    };
  });

  return <AdminPanel me={me} membres={rows} />;
}
