"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addMembre, deleteMembre, resetPassword, updateRole, type ActionResult } from "@/app/admin/actions";
import type { Membre, Role } from "@/lib/types";
import { BottomSheet, useUnsavedGuard } from "../BottomSheet";
import { IconPlus } from "../icons";
import { Toast, useToast } from "../Toast";

export type MembreRow = Membre & { hasAccount: boolean; lastSignIn: string | null; dossiers: number };

const ROLE_LABEL: Record<Role, string> = { commercial: "Commercial", directeur: "Directeur", admin: "Admin" };
/** Rôles attribuables ici. Directeur (comme admin) donne accès à l'Administration ; admin ne s'attribue pas depuis l'app. */
const ROLES_CHOIX: Role[] = ["commercial", "directeur"];
const ROLE_STYLE: Record<Role, string> = {
  commercial: "bg-brand-soft text-brand",
  directeur: "bg-[#fff4e0] text-[#9a5b00]",
  admin: "bg-[#f1e8ff] text-[#6a2bd8]",
};

/** Mot de passe provisoire lisible (sans caractères ambigus). */
function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function lastSeen(iso: string | null) {
  if (!iso) return "Aucune connexion";
  return `Vu le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })}`;
}

type Creds = { email: string; password: string } | null;

export function AdminPanel({ me, membres }: { me: Membre; membres: MembreRow[] }) {
  const { toast, showToast, showError } = useToast();
  const [ajout, setAjout] = useState({ open: false, key: 0 });
  const [selected, setSelected] = useState<MembreRow | null>(null);
  const [credentials, setCredentials] = useState<Creds>(null);

  /** Action réussie : message et, s'il y en a, identifiants à transmettre. */
  const reussi = (r: ActionResult & { ok: true }, creds: Creds) => {
    showToast(r.message);
    if (creds) setCredentials(creds);
  };

  const counts = {
    total: membres.length,
    commerciaux: membres.filter((m) => m.role === "commercial").length,
    jamais: membres.filter((m) => !m.lastSignIn).length,
  };

  return (
    <>
      {/* Contenu de l'en-tête à la largeur de la page : sur ordinateur, il n'est plus collé à gauche */}
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-white/90 px-4 pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/" aria-label="Revenir à l’accueil" className="grid size-11 place-items-center rounded-full bg-canvas text-xl">
            ‹
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">Administration</h1>
            <p className="text-[13px] text-muted">Comptes de l’équipe</p>
          </div>
          <button
            onClick={() => setAjout((a) => ({ open: true, key: a.key + 1 }))}
            className="hidden h-11 flex-none items-center gap-2 rounded-xl bg-brand px-4 font-bold text-white lg:flex"
          >
            <IconPlus className="size-5" />
            Ajouter un compte
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(110px+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ["Membres", counts.total],
            ["Commerciaux", counts.commerciaux],
            ["Sans connexion", counts.jamais],
          ].map(([label, value]) => (
            <div key={label} className="card min-w-0 px-2.5 pt-3 pb-2.5 min-[375px]:px-3">
              <b className="block text-[28px] leading-tight font-extrabold text-brand tabular-nums">{value}</b>
              {/* Un peu plus petit sur les petits écrans : « Commerciaux » tient dans sa case */}
              <span className="block text-[12px] leading-snug text-muted min-[375px]:text-[13px]">{label}</span>
            </div>
          ))}
        </div>

        {credentials && (
          <div className="mt-4 rounded-[18px] border border-ok-line bg-ok-soft p-3.5 text-[14px] text-ok-ink">
            <p className="font-bold">Identifiants à transmettre</p>
            <p className="mt-1">
              E-mail&nbsp;: <b className="break-all">{credentials.email}</b>
              <br />
              Mot de passe&nbsp;: <b className="font-mono tracking-wide">{credentials.password}</b>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const text = `Ton accès au suivi commercial mcaisse :\nE-mail : ${credentials.email}\nMot de passe provisoire : ${credentials.password}\nLien : ${window.location.origin}`;
                  try {
                    await navigator.clipboard.writeText(text);
                    showToast("Message copié");
                  } catch {
                    showError("Copie impossible : recopie l’e-mail et le mot de passe à la main.");
                  }
                }}
                className="min-h-11 rounded-xl bg-ok-ink px-3.5 font-semibold text-white"
              >
                Copier le message
              </button>
              <button onClick={() => setCredentials(null)} className="min-h-11 rounded-xl px-3.5 font-semibold">
                Masquer
              </button>
            </div>
          </div>
        )}

        <h2 className="section-title mt-5.5">Équipe</h2>
        <div className="card overflow-hidden">
          {membres.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${i ? "border-t border-line" : ""}`}
            >
              <span aria-hidden className="grid size-10 flex-none place-items-center rounded-full bg-brand-soft font-bold text-brand">
                {m.nom.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{m.nom}</span>
                  {m.id === me.id && <span className="text-[12px] text-muted">(moi)</span>}
                </span>
                <span className="block truncate text-[13px] text-muted">{m.email}</span>
                <span className="block text-[12px] text-muted">
                  {m.hasAccount ? lastSeen(m.lastSignIn) : "Pas de compte de connexion"}
                  {m.dossiers > 0 && ` · ${m.dossiers} dossier${m.dossiers > 1 ? "s" : ""}`}
                </span>
              </span>
              <span className={`flex-none rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${ROLE_STYLE[m.role]}`}>
                {ROLE_LABEL[m.role]}
              </span>
            </button>
          ))}
        </div>
      </main>

      <button
        onClick={() => setAjout((a) => ({ open: true, key: a.key + 1 }))}
        className="fixed right-4 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-30 flex h-14 items-center gap-2 rounded-full bg-brand px-5 font-bold text-white shadow-[0_8px_22px_rgba(17,94,245,.35)] lg:hidden"
      >
        <IconPlus className="size-5" />
        Ajouter un compte
      </button>

      <BottomSheet open={ajout.open} onClose={() => setAjout((a) => ({ ...a, open: false }))} label="Ajouter un compte">
        <AddForm
          key={ajout.key}
          onDone={(r, creds) => {
            setAjout((a) => ({ ...a, open: false }));
            reussi(r, creds);
          }}
        />
      </BottomSheet>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} label={selected ? `Compte de ${selected.nom}` : "Compte"}>
        {selected && (
          <EditMembre
            key={selected.id}
            membre={selected}
            isMe={selected.id === me.id}
            onDone={(r, creds) => {
              setSelected(null);
              reussi(r, creds);
            }}
          />
        )}
      </BottomSheet>

      <Toast message={toast} />
    </>
  );
}

const label = "mb-1.5 block text-[13.5px] text-muted";

function RolePicker({ value, onChange, id }: { value: Role; onChange: (r: Role) => void; id: string }) {
  return (
    <div role="group" aria-labelledby={id} className="mb-3 grid grid-cols-2 gap-2">
      {ROLES_CHOIX.map((r) => (
        <button
          type="button"
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={`min-h-12 rounded-xl px-2 text-[15px] ${
            value === r ? "border-2 border-brand bg-brand-soft font-semibold text-brand" : "border border-line"
          }`}
        >
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function Erreur({ texte }: { texte: string | null }) {
  return texte ? (
    <p role="alert" className="mb-2.5 text-[13.5px] text-danger">
      {texte}
    </p>
  ) : null;
}

function AddForm({ onDone }: { onDone: (r: ActionResult & { ok: true }, creds: Creds) => void }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("commercial");
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useUnsavedGuard(nom.trim() !== "" || email.trim() !== "");

  return (
    <form
      noValidate
      className="pb-4.5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await addMembre({ nom, email, role, password });
          if (!r.ok) return setError(r.error);
          onDone(r, r.accountCreated ? { email: email.trim().toLowerCase(), password } : null);
        });
      }}
    >
      <h2 className="mb-3.5 pr-12 text-xl font-bold">Ajouter un compte</h2>
      <label className="mb-3 block">
        <span className={label}>Prénom</span>
        <input className="input" name="prenom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Lamia" autoComplete="off" />
      </label>
      <label className="mb-3 block">
        <span className={label}>E-mail</span>
        <input
          className="input"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom@exemple.fr"
          autoComplete="off"
        />
      </label>
      <span id="role-ajout" className={label}>
        Rôle
      </span>
      <RolePicker id="role-ajout" value={role} onChange={setRole} />
      <label htmlFor="mdp-provisoire" className={label}>
        Mot de passe provisoire
      </label>
      <div className="mb-1.5 flex gap-2">
        <input
          id="mdp-provisoire"
          className="input font-mono"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="button" onClick={() => setPassword(generatePassword())} className="min-h-12 flex-none rounded-xl border border-line px-3.5 text-[14px]">
          Générer
        </button>
      </div>
      <p className="mb-4 text-[12.5px] text-muted">
        La personne pourra le changer avec «&nbsp;Mot de passe oublié&nbsp;?&nbsp;». Un directeur voit toute l’équipe et gère les comptes ; seuls les
        commerciaux apparaissent dans les filtres des dossiers.
      </p>
      <Erreur texte={error} />
      <button disabled={pending} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {pending ? "Ajout…" : "Ajouter le compte"}
      </button>
    </form>
  );
}

function EditMembre({
  membre,
  isMe,
  onDone,
}: {
  membre: MembreRow;
  isMe: boolean;
  onDone: (r: ActionResult & { ok: true }, creds: Creds) => void;
}) {
  const [role, setRole] = useState<Role>(membre.role);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useUnsavedGuard(role !== membre.role);

  /** Lance l'action ; l'erreur reste affichée dans la feuille. */
  const lancer = (action: () => Promise<ActionResult>, creds: Creds) =>
    start(async () => {
      setError(null);
      const r = await action();
      if (!r.ok) return setError(r.error);
      onDone(r, creds);
    });

  return (
    <div className="pb-4.5">
      <h2 className="pr-12 text-xl font-bold">{membre.nom}</h2>
      <p className="mb-4 text-[14px] break-all text-muted">{membre.email}</p>

      <span id="role-modif" className={label}>
        Rôle
      </span>
      <RolePicker id="role-modif" value={role} onChange={setRole} />
      <Erreur texte={error} />
      <button
        disabled={pending || role === membre.role}
        onClick={() => lancer(() => updateRole(membre.id, role), null)}
        className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-40"
      >
        Enregistrer le rôle
      </button>

      {membre.hasAccount && (
        <button
          disabled={pending}
          onClick={() => {
            const pwd = generatePassword();
            if (!confirm(`Remplacer le mot de passe de ${membre.nom} ? L’ancien ne marchera plus : il faudra lui transmettre le nouveau.`)) return;
            lancer(() => resetPassword(membre.email, pwd), { email: membre.email, password: pwd });
          }}
          className="mt-2 w-full rounded-2xl border border-line py-4 font-bold disabled:opacity-60"
        >
          Générer un nouveau mot de passe
        </button>
      )}

      {!isMe && (
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm(`Supprimer le compte de ${membre.nom} ? ${membre.nom} ne pourra plus se connecter. Ses dossiers sont conservés.`)) return;
            lancer(() => deleteMembre(membre.id), null);
          }}
          className="mt-2 w-full rounded-2xl py-4 font-bold text-danger disabled:opacity-60"
        >
          Supprimer le compte
        </button>
      )}
    </div>
  );
}
