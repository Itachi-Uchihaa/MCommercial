import { NextResponse, type NextRequest } from "next/server";
import { RDV_TYPES, addDays, fmtHeure, todayParis } from "@/lib/agenda";
import { parisTime } from "@/lib/dates";
import { preferencesDe } from "@/lib/notifications";
import { notifier } from "@/lib/push";
import { relancesDe } from "@/lib/relances";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Dossier, Membre, RendezVous } from "@/lib/types";

/**
 * Récap du matin, envoyé par Vercel Cron (vercel.json) du lundi au samedi.
 * Commercial : ses RDV du jour et ses relances. Direction : RDV de l'équipe et dossiers à débloquer.
 * Protégé par CRON_SECRET (Vercel l'envoie en « Authorization: Bearer … »).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const today = todayParis();
  const nowTime = parisTime();
  const admin = createAdminClient();
  const [{ data: membres }, { data: dossiersData }, { data: rdvsData }] = await Promise.all([
    admin.from("membres").select("*"),
    admin.from("dossiers").select("*").is("perdu_le", null),
    admin.from("rendez_vous").select("*").gte("jour", addDays(today, -30)).lte("jour", today).order("debut"),
  ]);
  const dossiers = (dossiersData ?? []) as Dossier[];
  const rdvs = (rdvsData ?? []) as RendezVous[];
  const duJour = rdvs.filter((r) => r.jour === today);

  let envoyes = 0;
  for (const m of (membres ?? []) as Membre[]) {
    if (!preferencesDe(m).includes("recap_matin")) continue; // désactivé dans Paramètres
    let notif;
    if (m.role === "commercial") {
      const siens = duJour.filter((r) => r.commercial === m.nom);
      const relances = relancesDe({
        dossiers: dossiers.filter((d) => d.commercial === m.nom),
        rdvs: rdvs.filter((r) => r.commercial === m.nom),
        today,
        nowTime,
      });
      if (!siens.length && !relances.length) continue;
      const premier = siens[0];
      notif = {
        title: `Bonjour ${m.nom}`,
        body: [
          premier
            ? `${siens.length} RDV aujourd’hui, le premier à ${fmtHeure(premier.debut)} (${RDV_TYPES[premier.type]} chez ${premier.restaurant})`
            : "Aucun RDV aujourd’hui",
          relances.length ? `${relances.length} à relancer` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        url: "/",
        tag: `matin-${today}`,
      };
    } else {
      const blocages = relancesDe({ dossiers, rdvs, today, nowTime, blocages: true });
      notif = {
        title: "L’équipe aujourd’hui",
        body: `${duJour.length} RDV prévu${duJour.length > 1 ? "s" : ""} · ${blocages.length} dossier${blocages.length > 1 ? "s" : ""} à débloquer`,
        url: "/equipe",
        tag: `matin-${today}`,
      };
    }
    envoyes += await notifier([m.email], notif);
  }

  return NextResponse.json({ envoyes });
}
