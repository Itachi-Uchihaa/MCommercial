"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("8 caractères minimum.");
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisis un mot de passe d’au moins 8 caractères.">
      <form onSubmit={onSubmit} noValidate>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13.5px] text-muted">Mot de passe</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mb-2.5 text-[13.5px] text-danger">{error}</p>}
        <button disabled={loading} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
          Enregistrer
        </button>
      </form>
    </AuthCard>
  );
}
