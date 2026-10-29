import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";

export default function CommercialIntrouvable() {
  return (
    <AuthCard title="Commercial introuvable" subtitle="Ce commercial ne fait plus partie de l’équipe, ou son prénom a changé.">
      <Link href="/equipe" className="block w-full rounded-2xl bg-brand py-4 text-center font-bold text-white">
        Revenir à l’équipe
      </Link>
    </AuthCard>
  );
}
