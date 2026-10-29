"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Membre } from "@/lib/types";
import { IconChevronLeft, IconPlus } from "./icons";
import { McaisseLogo, McaisseMark } from "./McaisseLogo";
import { NAV, TabBar, type Page } from "./navigation";
import { SignOutButton } from "./SignOutButton";

export type { Page };

export type Action = { label: string; href?: string; onClick?: () => void };

type Props = {
  me: Membre;
  canAdmin: boolean;
  /** Connexion temps réel active. */
  live: boolean;
  page: Page;
  title: string;
  subtitle?: React.ReactNode;
  /** Action principale : bouton flottant sur téléphone, bouton de l'en-tête sur ordinateur. */
  action?: Action;
  /** Lien de retour au-dessus du titre (ex. fiche client → Dossiers). */
  back?: { href: string; label: string };
  children: React.ReactNode;
};

/** Cadre des écrans : onglets en bas sur téléphone, menu latéral sur ordinateur. */
export function AppShell({ me, canAdmin, live, page, title, subtitle, action, back, children }: Props) {
  return (
    <div className="lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 flex-none flex-col border-r border-line bg-white px-3 py-6 lg:flex">
        <Link href="/" className="mb-6 px-2">
          <McaisseLogo suffix="Suivi" />
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {NAV.map(({ key, href, label, Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={key === page ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 font-semibold ${
                key === page ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-canvas"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
          <p className="flex items-center gap-2 px-3 pb-1 text-[13px] text-muted">
            <LiveDot live={live} />
            <span className="truncate">{live ? `En direct · ${me.nom}` : "Connexion…"}</span>
          </p>
          {canAdmin && (
            <Link href="/admin" className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink-soft hover:bg-canvas">
              Administration
            </Link>
          )}
          <Link href="/parametres" className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink-soft hover:bg-canvas">
            Paramètres
          </Link>
          <SignOutButton className="flex min-h-11 items-center rounded-xl px-3 text-left font-semibold text-ink-soft hover:bg-canvas">
            Se déconnecter
          </SignOutButton>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mx-auto flex max-w-3xl items-start gap-3 px-4 pt-[calc(16px+env(safe-area-inset-top,0px))] lg:max-w-6xl lg:items-end lg:px-8 lg:pt-8">
          <div className="min-w-0 flex-1">
            {back ? (
              <Link href={back.href} className="-ml-1.5 flex min-h-11 w-fit items-center gap-0.5 pr-2 text-[15px] font-semibold text-brand">
                <IconChevronLeft className="size-5" />
                {back.label}
              </Link>
            ) : (
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold lg:hidden">
                <McaisseMark className="h-3.5 w-auto" />
                <span>
                  <span className="text-brand">m</span>caisse
                </span>
              </p>
            )}
            <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-balance break-words hyphens-auto">{title}</h1>
            {subtitle && <p className="mt-0.5 text-[14px] text-muted">{subtitle}</p>}
          </div>
          {action && <ActionLink action={action} className="hidden h-11 rounded-xl px-4 lg:flex" />}
          <AccountMenu me={me} canAdmin={canAdmin} live={live} />
        </header>

        <main className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(170px+env(safe-area-inset-bottom,0px))] lg:max-w-6xl lg:px-8 lg:pb-16">
          {children}
        </main>
      </div>

      {action && (
        <ActionLink
          action={action}
          className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-30 flex h-14 rounded-full px-5 shadow-[0_8px_22px_rgba(17,94,245,.35)] lg:hidden"
        />
      )}

      <TabBar page={page} />
    </div>
  );
}

/** `className` doit donner l'affichage (flex), sinon l'icône (svg en bloc) passe au-dessus du texte. */
function ActionLink({ action, className }: { action: Action; className: string }) {
  const cls = `items-center gap-2 whitespace-nowrap bg-brand font-bold text-white flex-none ${className}`;
  const content = (
    <>
      <IconPlus className="size-5" />
      {action.label}
    </>
  );
  return action.href ? (
    <Link href={action.href} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={cls}>
      {content}
    </button>
  );
}

function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden
      className={`size-2 flex-none rounded-full ${live ? "bg-ok shadow-[0_0_0_3px_var(--color-ok-soft)]" : "bg-[#c4c8d2]"}`}
    />
  );
}

/** Menu du compte (téléphone) : Paramètres, Administration, déconnexion. */
function AccountMenu({ me, canAdmin, live }: { me: Membre; canAdmin: boolean; live: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-none lg:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Mon compte${live ? ", en direct" : ""}`}
        aria-expanded={open}
        className="relative size-11 rounded-full bg-brand-soft text-[17px] font-bold text-brand"
      >
        {me.nom.trim().charAt(0).toUpperCase()}
        <span
          aria-hidden
          className={`absolute right-0 bottom-0 size-3 rounded-full border-2 border-canvas ${live ? "bg-ok" : "bg-[#c4c8d2]"}`}
        />
      </button>
      {open && (
        <div className="absolute top-13 right-0 z-40 min-w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_30px_rgba(15,23,51,.12)]">
          <div className="border-b border-line px-3.5 py-3 text-[13.5px] text-muted">
            <span className="block font-semibold text-ink">{me.nom}</span>
            <span className="block truncate">{me.email}</span>
            <span className="mt-1 flex items-center gap-1.5">
              <LiveDot live={live} />
              {live ? "En direct" : "Connexion…"}
            </span>
          </div>
          <Link href="/parametres" className="flex min-h-12 items-center border-b border-line px-3.5 text-[15px]">
            Paramètres
          </Link>
          {canAdmin && (
            <Link href="/admin" className="flex min-h-12 items-center border-b border-line px-3.5 text-[15px] font-semibold text-brand">
              Administration
            </Link>
          )}
          <SignOutButton className="flex min-h-12 w-full items-center px-3.5 text-left text-[15px]">Se déconnecter</SignOutButton>
        </div>
      )}
    </div>
  );
}
