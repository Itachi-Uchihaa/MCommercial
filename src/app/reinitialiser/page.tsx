"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { createClient } from "@/lib/supabase/client";

/** Message lisible pour une erreur Supabase au changement de mot de passe. */
function message(code: string | undefined) {
  if (code === "same_password") return "Choisis un mot de passe différent de l’ancien.";
  if (code === "weak_password") return "Ce mot de passe est trop simple : mélange lettres et chiffres, 8 caractères minimum.";
  if (code === "session_not_found" || code === "session_expired") return "expire";
  return "Le mot de passe n’a pas pu être enregistré. Vérifie ton réseau et réessaie.";
}

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErreur("Ton mot de passe doit faire au moins 8 caractères.");
      return champ.current?.focus();
    }
    setErreur(null);
    setEnvoi(true);
    const { error } = await createClient().auth.updateUser({ password });
    setEnvoi(false);
    if (error) return setErreur(message(error.code));
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Nouveau mot de passe</h1>
      <p className="mt-1.5 mb-7 text-[15px] text-muted">Choisis un mot de passe d’au moins 8 caractères.</p>
      <form onSubmit={onSubmit} noValidate className="grid gap-4.5">
        {erreur && (
          <p id="erreur" role="alert" className="rounded-xl bg-[#fdecea] px-3 py-2.5 text-[14px] text-danger">
            {erreur === "expire" ? (
              <>
                Ce lien a expiré.{" "}
                <Link href="/login" className="font-bold underline">
                  Redemande un lien
                </Link>{" "}
                depuis la page de connexion.
              </>
            ) : (
              erreur
            )}
          </p>
        )}
        <PasswordField
          ref={champ}
          id="password"
          label="Nouveau mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          invalid={!!erreur && erreur !== "expire"}
          describedBy={erreur ? "erreur" : undefined}
        />
        <button
          type="submit"
          disabled={envoi}
          className="mt-1 flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-brand font-bold text-white shadow-[0_6px_18px_rgba(17,94,245,.28)] hover:bg-[#0d52dc] disabled:cursor-progress disabled:opacity-85"
        >
          {envoi && (
            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
          )}
          {envoi ? "Enregistrement…" : "Enregistrer et me connecter"}
        </button>
      </form>
    </AuthShell>
  );
}
