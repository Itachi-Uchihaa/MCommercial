"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  return (
    <button
      type="button"
      disabled={enCours}
      className={`${className ?? ""} disabled:opacity-60`}
      onClick={async () => {
        setEnCours(true);
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      {enCours ? "Déconnexion…" : children}
    </button>
  );
}
