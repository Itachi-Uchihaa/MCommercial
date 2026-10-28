"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return setError("Email ou mot de passe incorrect.");
    router.replace("/");
    router.refresh();
  }

  async function onForgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError("Saisis d’abord ton email.");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reinitialiser`,
    });
    if (error) return setError(error.message);
    setInfo("Si ce compte existe, un lien de réinitialisation vient d’être envoyé.");
  }

  return (
    <AuthCard title="Suivi commercial" subtitle="Connecte-toi avec ton compte mcaisse.">
      <form onSubmit={onSubmit} noValidate>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13.5px] text-muted">Email</span>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13.5px] text-muted">Mot de passe</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="mb-2.5 text-[13.5px] text-danger">{error}</p>}
        {info && <p className="mb-2.5 text-sm text-ok">{info}</p>}
        <button
          disabled={loading}
          className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        <button type="button" onClick={onForgot} className="w-full pt-3 text-[14.5px] text-brand">
          Mot de passe oublié ?
        </button>
      </form>
    </AuthCard>
  );
}
