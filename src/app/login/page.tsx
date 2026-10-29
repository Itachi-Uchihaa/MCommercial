"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { createClient } from "@/lib/supabase/client";

type Erreur = { texte: string; champ: "email" | "password" | "les-deux" };

/** Message lisible pour une erreur de connexion Supabase. */
function messageConnexion(code: string | undefined) {
  if (code === "invalid_credentials")
    return "Adresse e-mail ou mot de passe incorrect. Vérifie-les, ou touche « Mot de passe oublié ? ».";
  if (code === "email_not_confirmed") return "Ton compte n’est pas encore activé. Demande à ton responsable.";
  if (code === "over_request_rate_limit") return "Trop d’essais : attends une minute avant de réessayer.";
  return "Connexion impossible pour le moment. Vérifie ton réseau et réessaie.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"connexion" | "oubli" | "envoye">("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<Erreur | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function changerMode(m: typeof mode) {
    setErreur(null);
    setMode(m);
  }

  // « Mot de passe oublié » : le curseur va directement dans le champ e-mail
  useEffect(() => {
    if (mode === "oubli") emailRef.current?.focus();
  }, [mode]);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    // En cas d'erreur, le curseur va sur le champ à corriger
    if (!email.trim()) {
      setErreur({ texte: "Saisis ton adresse e-mail.", champ: "email" });
      return emailRef.current?.focus();
    }
    if (!password) {
      setErreur({ texte: "Saisis ton mot de passe.", champ: "password" });
      return passwordRef.current?.focus();
    }
    setErreur(null);
    setEnvoi(true);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setEnvoi(false);
      setErreur({ texte: messageConnexion(error.code), champ: "les-deux" });
      return passwordRef.current?.select();
    }
    router.replace("/");
    router.refresh();
  }

  async function envoyerLien(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setErreur({ texte: "Saisis ton adresse e-mail.", champ: "email" });
      return emailRef.current?.focus();
    }
    setErreur(null);
    setEnvoi(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reinitialiser`,
    });
    setEnvoi(false);
    if (error) {
      return setErreur({
        texte:
          error.code === "over_email_send_rate_limit"
            ? "Un lien vient déjà d’être envoyé. Attends quelques minutes avant d’en redemander un."
            : "Le lien n’a pas pu être envoyé. Vérifie ton réseau et réessaie.",
        champ: "email",
      });
    }
    setMode("envoye");
  }

  const emailInvalide = erreur?.champ === "email" || erreur?.champ === "les-deux";
  const passwordInvalide = erreur?.champ === "password" || erreur?.champ === "les-deux";

  const champEmail = (
    <div className="grid gap-2">
      <label htmlFor="email" className="text-[14px] font-semibold">
        Adresse e-mail
      </label>
      <input
        ref={emailRef}
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="prenom@exemple.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={emailInvalide || undefined}
        aria-describedby={emailInvalide ? "erreur" : undefined}
        className="input"
      />
    </div>
  );

  const bandeauErreur = erreur && (
    <p id="erreur" role="alert" className="flex items-start gap-2 rounded-xl bg-[#fdecea] px-3 py-2.5 text-[14px] text-danger">
      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 flex-none" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5M12 16.5h.01" />
      </svg>
      {erreur.texte}
    </p>
  );

  const bouton = (texte: string, enCours: string) => (
    <button
      type="submit"
      disabled={envoi}
      className="mt-1 flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-brand font-bold text-white shadow-[0_6px_18px_rgba(17,94,245,.28)] hover:bg-[#0d52dc] disabled:cursor-progress disabled:opacity-85"
    >
      {envoi && (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
      )}
      {envoi ? enCours : texte}
    </button>
  );

  return (
    <AuthShell>
      {mode === "connexion" && (
        <>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Connexion</h1>
          <p className="mt-1.5 mb-7 text-[15px] text-muted">Retrouve tes dossiers, ton agenda et tes relances.</p>
          <form onSubmit={seConnecter} noValidate className="grid gap-4.5">
            {bandeauErreur}
            {champEmail}
            <PasswordField
              ref={passwordRef}
              id="password"
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              invalid={passwordInvalide}
              describedBy={passwordInvalide ? "erreur" : undefined}
              aside={
                <button
                  type="button"
                  onClick={() => changerMode("oubli")}
                  className="-mx-1 -my-3 px-1 py-3 text-[14px] font-semibold text-brand"
                >
                  Mot de passe oublié&nbsp;?
                </button>
              }
            />
            {bouton("Se connecter", "Connexion…")}
          </form>
        </>
      )}

      {mode === "oubli" && (
        <>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Mot de passe oublié</h1>
          <p className="mt-1.5 mb-7 text-[15px] text-muted">Saisis ton adresse e-mail&nbsp;: tu recevras un lien pour en choisir un nouveau.</p>
          <form onSubmit={envoyerLien} noValidate className="grid gap-4.5">
            {bandeauErreur}
            {champEmail}
            {bouton("Recevoir le lien", "Envoi…")}
          </form>
          <button type="button" onClick={() => changerMode("connexion")} className="mt-3 min-h-11 w-full font-semibold text-brand">
            Revenir à la connexion
          </button>
        </>
      )}

      {mode === "envoye" && (
        <>
          <div aria-hidden className="mb-4 grid size-12 place-items-center rounded-2xl bg-ok-soft text-ok-ink">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Regarde tes e-mails</h1>
          <p role="status" className="mt-1.5 mb-7 text-[15px] text-muted">
            Si un compte existe pour <b className="font-semibold text-ink">{email.trim()}</b>, un lien vient d’être envoyé. Pense à regarder
            dans les spams.
          </p>
          <button
            type="button"
            onClick={() => changerMode("connexion")}
            className="flex h-13 w-full items-center justify-center rounded-2xl border border-line bg-white font-bold"
          >
            Revenir à la connexion
          </button>
        </>
      )}
    </AuthShell>
  );
}
