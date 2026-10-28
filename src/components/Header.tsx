"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Membre } from "@/lib/types";
import { SignOutButton } from "./SignOutButton";

export function Header({ me, live }: { me: Membre; live: boolean }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  return (
    <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-4 pb-3 backdrop-blur-md">
      <Image src="/icons/icon-192.png" alt="mcaisse" width={40} height={40} className="rounded-[11px]" priority />
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-extrabold tracking-tight">Dossiers commerciaux</h1>
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <span
            className={`size-2 flex-none rounded-full ${live ? "bg-ok shadow-[0_0_0_3px_var(--color-ok-soft)]" : "bg-[#c4c8d2]"}`}
          />
          {live ? `En direct · ${me.nom}` : "Connexion…"}
        </p>
      </div>
      <div ref={ref} className="relative">
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label="Mon compte"
          aria-expanded={menu}
          className="size-9.5 rounded-full bg-brand-soft font-bold text-brand"
        >
          {me.nom.trim().charAt(0).toUpperCase()}
        </button>
        {menu && (
          <div className="absolute top-12 right-0 min-w-56 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_30px_rgba(15,23,51,.12)]">
            <div className="border-b border-line px-3.5 py-3 text-[13.5px] text-muted">
              {me.nom} · {me.email}
            </div>
            <SignOutButton className="block w-full px-3.5 py-3 text-left text-[15px]">Se déconnecter</SignOutButton>
          </div>
        )}
      </div>
    </header>
  );
}
