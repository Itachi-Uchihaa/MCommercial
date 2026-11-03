import Link from "next/link";
import { IconCalendar, IconChart, IconFolder, IconSun, IconUserCheck, IconUsers } from "./icons";

export type Page = "aujourdhui" | "dossiers" | "clients" | "agenda" | "equipe" | "presences";

export const NAV: { key: Page; href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: "aujourdhui", href: "/", label: "Aujourd’hui", Icon: IconSun },
  { key: "dossiers", href: "/dossiers", label: "Dossiers", Icon: IconFolder },
  { key: "clients", href: "/clients", label: "Clients", Icon: IconUsers },
  { key: "agenda", href: "/agenda", label: "Agenda", Icon: IconCalendar },
  { key: "equipe", href: "/equipe", label: "Équipe", Icon: IconChart },
];

/** Hors des onglets du bas (5 au plus pour rester faciles à toucher) : menu de gauche et menu du compte. */
export const PRESENCES = { key: "presences" as const, href: "/presences", label: "Présences", Icon: IconUserCheck };

/** Nombre affiché à côté d'un onglet (ex. dossiers en cours). */
export type Badges = Partial<Record<Page, number | null>>;

/** Libellé lu par les lecteurs d'écran pour un badge. */
export const libelleBadge = (key: Page, n: number) =>
  key === "dossiers" ? `${n} dossier${n > 1 ? "s" : ""} en cours` : String(n);

/** Onglets du bas (téléphone). Sans `page` : aucun onglet actif (écran de chargement). */
export function TabBar({ page, badges = {} }: { page?: Page; badges?: Badges }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] backdrop-blur-md lg:hidden"
    >
      {NAV.map(({ key, href, label, Icon }) => {
        const n = badges[key];
        return (
          <Link
            key={key}
            href={href}
            aria-current={key === page ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] ${
              key === page ? "font-bold text-brand" : "font-semibold text-muted"
            }`}
          >
            <span className="relative">
              <Icon className="size-[22px]" />
              {!!n && (
                <span className="absolute -top-1.5 left-[15px] min-w-[18px] rounded-full border-2 border-white bg-brand px-1 text-center text-[10.5px] leading-[14px] font-bold text-white tabular-nums">
                  {n > 99 ? "99+" : n}
                </span>
              )}
            </span>
            {label}
            {!!n && <span className="sr-only">, {libelleBadge(key, n)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
