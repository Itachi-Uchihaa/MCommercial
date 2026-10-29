"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MenuFichier } from "@/lib/types";
import { IconDownload, IconPlus, IconX } from "../icons";

export type FichierMenu = MenuFichier & { url: string | null };

type Props = {
  dossierId: string;
  restaurant: string;
  fichiers: FichierMenu[];
  /** Le commercial du dossier, la direction et les admins peuvent retirer un fichier. */
  peutSupprimer: boolean;
  onMessage: (message: string) => void;
  onErreur: (message: string) => void;
};

const TAILLE_MAX = 15 * 1024 * 1024; // Limite de l'espace de stockage « menus »
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const estPdf = (type: string) => type === "application/pdf";

/** Photo trop lourde pour un envoi en 4G : réduite à 2 000 px de côté, en JPEG. HEIC et PDF passent tels quels. */
async function alleger(f: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size < 1.5 * 1024 * 1024) return f;
  try {
    const img = await createImageBitmap(f);
    const echelle = Math.min(1, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * echelle);
    canvas.height = Math.round(img.height * echelle);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

const extension = (f: File) => (estPdf(f.type) ? "pdf" : f.type.split("/")[1].replace("jpeg", "jpg"));

/** Menu du restaurant (facultatif) : photos ou PDF, à l'étape « Groupe SAV créé ». */
export function MenuSav({ dossierId, restaurant, fichiers, peutSupprimer, onMessage, onErreur }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [zip, setZip] = useState(false);
  const [retrait, setRetrait] = useState<string | null>(null);
  // Fichiers retirés : masqués tout de suite, sans attendre le rechargement de la page
  const [retires, setRetires] = useState<string[]>([]);
  const visibles = fichiers.filter((f) => !retires.includes(f.id));

  async function ajouter(liste: FileList | null) {
    const choisis = [...(liste ?? [])];
    if (input.current) input.current.value = "";
    if (!choisis.length) return;
    const refuses = choisis.filter((f) => !TYPES.includes(f.type));
    const valides = choisis.filter((f) => TYPES.includes(f.type));
    if (refuses.length) onErreur("Seules les photos (JPEG, PNG, HEIC) et les PDF sont acceptés.");
    if (!valides.length) return;

    const supabase = createClient();
    const { data: session } = await supabase.auth.getClaims();
    let ok = 0;
    setEnvoi({ fait: 0, total: valides.length });
    for (const brut of valides) {
      const f = await alleger(brut);
      if (f.size > TAILLE_MAX) {
        onErreur(`« ${brut.name} » dépasse 15 Mo.`);
      } else {
        const chemin = `${dossierId}/${crypto.randomUUID()}.${extension(f)}`;
        const { error } = await supabase.storage.from("menus").upload(chemin, f, { contentType: f.type });
        const { error: errLigne } = error
          ? { error }
          : await supabase
              .from("menu_fichiers")
              .insert({ dossier_id: dossierId, chemin, nom: brut.name, type: f.type, taille: f.size, created_by: session?.claims?.sub });
        if (errLigne) {
          // Fichier envoyé mais pas enregistré : on ne le laisse pas traîner dans le stockage
          if (!error) await supabase.storage.from("menus").remove([chemin]);
          console.error("Fichier du menu non envoyé", errLigne);
          onErreur(`« ${brut.name} » n’a pas pu être envoyé. Vérifie ta connexion et réessaie.`);
        } else ok++;
      }
      setEnvoi((e) => e && { ...e, fait: e.fait + 1 });
    }
    setEnvoi(null);
    if (ok) {
      onMessage(ok > 1 ? `${ok} fichiers ajoutés au menu` : "Fichier ajouté au menu");
      router.refresh();
    }
  }

  async function retirer(f: FichierMenu) {
    if (!confirm(`Retirer « ${f.nom} » du menu ? Le fichier sera supprimé.`)) return;
    setRetrait(f.id);
    const supabase = createClient();
    const { error } = await supabase.storage.from("menus").remove([f.chemin]);
    const { error: errLigne } = error ? { error } : await supabase.from("menu_fichiers").delete().eq("id", f.id);
    setRetrait(null);
    if (errLigne) {
      console.error("Fichier du menu non retiré", errLigne);
      return onErreur("Le fichier n’a pas pu être retiré. Réessaie.");
    }
    setRetires((r) => [...r, f.id]);
    onMessage("Fichier retiré du menu");
    router.refresh();
  }

  /** Un seul fichier : téléchargé tel quel. Plusieurs : rassemblés dans un .zip. */
  async function toutTelecharger() {
    const dispo = visibles.filter((f) => f.url);
    if (!dispo.length) return;
    setZip(true);
    try {
      const base = `menu-${restaurant.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}`;
      const blobs = await Promise.all(dispo.map(async (f) => (await fetch(f.url!)).blob()));
      let blob: Blob;
      let nom: string;
      if (dispo.length === 1) {
        blob = blobs[0];
        nom = `${base}.${dispo[0].chemin.split(".").pop()}`;
      } else {
        const { default: JSZip } = await import("jszip");
        const archive = new JSZip();
        dispo.forEach((f, i) => archive.file(`${String(i + 1).padStart(2, "0")}-${f.nom}`, blobs[i]));
        blob = await archive.generateAsync({ type: "blob" });
        nom = `${base}.zip`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      a.click();
      // Différé : Safari sur iPhone annule le téléchargement si l'adresse est libérée tout de suite
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error("Téléchargement du menu impossible", e);
      onErreur("Le téléchargement a échoué. Recharge la page et réessaie.");
    } finally {
      setZip(false);
    }
  }

  return (
    <div className="mt-2 rounded-[14px] border border-line bg-canvas/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">
          Menu <span className="font-normal text-muted">· facultatif</span>
        </p>
        {visibles.length > 0 && (
          <button
            type="button"
            onClick={toutTelecharger}
            disabled={zip}
            className="flex min-h-11 items-center gap-1.5 px-1 text-[14px] font-bold text-brand disabled:opacity-60"
          >
            <IconDownload className="size-4.5" />
            {zip ? "Préparation…" : visibles.length > 1 ? "Tout télécharger" : "Télécharger"}
          </button>
        )}
      </div>

      {visibles.length > 0 && (
        <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visibles.map((f) => (
            <li key={f.id} className="relative">
              <a
                href={f.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ouvrir ${f.nom}`}
                className="block aspect-square overflow-hidden rounded-xl border border-line bg-white"
              >
                {estPdf(f.type) || !f.url ? (
                  <span className="grid h-full place-items-center p-1.5 text-center">
                    <span>
                      <span className="mx-auto block w-fit rounded-md bg-danger px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                        {estPdf(f.type) ? "PDF" : "Photo"}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[11.5px] break-all text-muted">{f.nom}</span>
                    </span>
                  </span>
                ) : (
                  // Lien signé (privé, valable une heure) : pas d'optimisation d'image par Next
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </a>
              {peutSupprimer && (
                <button
                  type="button"
                  onClick={() => retirer(f)}
                  disabled={retrait === f.id}
                  aria-label={`Retirer ${f.nom}`}
                  className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border border-line bg-white text-ink-soft shadow-sm disabled:opacity-60"
                >
                  <IconX className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => ajouter(e.target.files)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={!!envoi}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#b9c3d6] bg-white text-[14px] font-semibold text-brand disabled:opacity-70"
      >
        {envoi ? (
          `Envoi ${Math.min(envoi.fait + 1, envoi.total)} sur ${envoi.total}…`
        ) : (
          <>
            <IconPlus className="size-4.5" />
            {visibles.length ? "Ajouter d’autres fichiers" : "Ajouter des photos ou un PDF"}
          </>
        )}
      </button>
    </div>
  );
}
