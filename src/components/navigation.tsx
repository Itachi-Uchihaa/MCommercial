import Link from "next/link";
import { IconCalendar, IconChart, IconFolder, IconSun, IconUsers } from "./icons";

export type Page = "aujourdhui" | "dossiers" | "clients" | "agenda" | "equipe";

export const NAV: { key: Page; href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: "aujourdhui", href: "/", label: "Aujourd’hui", Icon: IconSun },
  { key: "dossiers", href: "/dossiers", label: "Dossiers", Icon: IconFolder },
  { key: "clients", href: "/clients", label: "Clients", Icon: IconUsers },
  { key: "agenda", href: "/agenda", label: "Agenda", Icon: IconCalendar },
  { key: "equipe", href: "/equipe", label: "Équipe", Icon: IconChart },
];

/** Onglets du bas (téléphone). Sans `page` : aucun onglet actif (écran de chargement). */
export function TabBar({ page }: { page?: Page }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] backdrop-blur-md lg:hidden"
    >
      {NAV.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === page ? "page" : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] ${
            key === page ? "font-bold text-brand" : "font-semibold text-muted"
          }`}
        >
          <Icon className="size-[22px]" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
