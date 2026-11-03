"use client";

import { useEffect, useState } from "react";
import { todayParis } from "@/lib/agenda";
import { createClient } from "@/lib/supabase/client";
import type { Membre } from "@/lib/types";

// Dernier nombre connu : le badge ne disparaît pas d'un écran à l'autre
let dernier: number | null = null;

/**
 * Nombre de dossiers en cours (ni perdus, ni terminés), pour le badge du menu « Dossiers ».
 * Un commercial voit les siens, la direction et les admins ceux de toute l'équipe.
 * Mis à jour dès qu'un dossier change et quand le téléphone sort de veille.
 */
export function useDossiersEnCours(me: Membre) {
  const [n, setN] = useState(dernier);

  useEffect(() => {
    const supabase = createClient();
    let annule = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function compter() {
      // Même règle que enCours() : pas perdu, accompagnement pas encore fait
      let q = supabase
        .from("dossiers")
        .select("id", { count: "exact", head: true })
        .is("perdu_le", null)
        .or(`date_accompagnement.is.null,date_accompagnement.gt.${todayParis()}`);
      if (me.role === "commercial") q = q.eq("commercial", me.nom);
      const { count, error } = await q;
      if (annule || error || count === null) return;
      dernier = count;
      setN(count);
    }
    const plusTard = () => {
      clearTimeout(timer);
      timer = setTimeout(compter, 300);
    };

    compter();
    const channel = supabase
      .channel(`en-cours:${me.nom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dossiers" }, plusTard)
      .subscribe();
    const onVisible = () => !document.hidden && plusTard();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      annule = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [me.role, me.nom]);

  return n;
}
