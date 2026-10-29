import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";

export default function DossierIntrouvable() {
  return (
    <AuthCard title="Dossier introuvable" subtitle="Ce dossier a peut-être été supprimé par un collègue.">
      <Link href="/dossiers" className="block w-full rounded-2xl bg-brand py-4 text-center font-bold text-white">
        Revenir aux dossiers
      </Link>
    </AuthCard>
  );
}
