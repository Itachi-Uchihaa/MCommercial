"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addMembre, deleteMembre, resetPassword, updateRole, type ActionResult } from "@/app/admin/actions";
import type { Membre, Role } from "@/lib/types";
import { Toast, useToast } from "../Toast";

export type MembreRow = Membre & { hasAccount: boolean; lastSignIn: string | null; dossiers: number };

const ROLE_LABEL: Record<Role, string> = { commercial: "Commercial", directeur: "Directeur", admin: "Admin" };
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
  if (!iso) return "Jamais connecté";
  return `Vu le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

export function AdminPanel({ me, membres }: { me: Membre; membres: MembreRow[] }) {
  const { toast, showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<MembreRow | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const done = (r: ActionResult) => {
    showToast(r.ok ? r.message : r.error);
    return r.ok;
  };

  const counts = {
    total: membres.length,
    commerciaux: membres.filter((m) => m.role === "commercial").length,
    jamais: membres.filter((m) => !m.lastSignIn).length,
  };

  return (
    <>
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-4 pb-3 backdrop-blur-md">
        <Link href="/" aria-label="Retour aux dossiers" className="grid size-10 place-items-center rounded-full bg-canvas text-xl">
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">Administration</h1>
          <p className="text-[13px] text-muted">Comptes de l’équipe</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(110px+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ["Membres", counts.total],
            ["Commerciaux", counts.commerciaux],
            ["Jamais connectés", counts.jamais],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-[18px] border border-line bg-white px-3 pt-3 pb-2.5">
              <b className="block text-[28px] leading-tight font-extrabold text-brand tabular-nums">{value}</b>
              <span className="block text-[13px] text-muted">{label}</span>
            </div>
          ))}
        </div>

        {credentials && (
          <div className="mt-4 rounded-[18px] border border-ok-line bg-ok-soft p-3.5 text-[14px] text-ok-ink">
            <p className="font-bold">Identifiants à transmettre</p>
            <p className="mt-1">
              Email : <b>{credentials.email}</b>
              <br />
              Mot de passe : <b className="font-mono tracking-wide">{credentials.password}</b>
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={async () => {
                  const text = `Ton accès au suivi commercial mcaisse :\nEmail : ${credentials.email}\nMot de passe provisoire : ${credentials.password}\nLien : ${window.location.origin}`;
                  try {
                    await navigator.clipboard.writeText(text);
                    showToast("Copié");
                  } catch {
                    showToast("Copie impossible, recopie-les à la main.");
                  }
                }}
                className="rounded-xl bg-ok px-3.5 py-2 font-semibold text-white"
              >
                Copier le message
              </button>
              <button onClick={() => setCredentials(null)} className="rounded-xl px-3.5 py-2 font-semibold">
                Masquer
              </button>
            </div>
          </div>
        )}

        <div className="mx-0.5 mt-5.5 mb-2.5 text-[13px] font-bold tracking-wider text-muted uppercase">Équipe</div>
        <div className="overflow-hidden rounded-[18px] border border-line bg-white">
          {membres.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${i ? "border-t border-line" : ""}`}
            >
              <span className="grid size-10 flex-none place-items-center rounded-full bg-brand-soft font-bold text-brand">
                {m.nom.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{m.nom}</span>
                  {m.id === me.id && <span className="text-[12px] text-muted">(toi)</span>}
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
        onClick={() => setAdding(true)}
        className="fixed right-4.5 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-30 h-14 rounded-full bg-brand px-5.5 font-bold text-white shadow-[0_8px_22px_rgba(17,94,245,.35)]"
      >
        + Ajouter un compte
      </button>

      {adding && (
        <Sheet onClose={() => setAdding(false)}>
          <AddForm
            onDone={(r, creds) => {
              if (done(r)) {
                setAdding(false);
                if (creds) setCredentials(creds);
              }
            }}
          />
        </Sheet>
      )}

      {selected && (
        <Sheet onClose={() => setSelected(null)}>
          <EditMembre
            membre={selected}
            isMe={selected.id === me.id}
            onDone={(r, creds) => {
              if (done(r)) {
                setSelected(null);
                if (creds) setCredentials(creds);
              }
            }}
          />
        </Sheet>
      )}

      <Toast message={toast} />
    </>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-ink/35" />
      <div
        role="dialog"
        aria-modal="true"
        className="safe-bottom fixed inset-x-0 bottom-0 z-41 mx-auto max-h-[92dvh] max-w-3xl overflow-y-auto rounded-t-[22px] bg-white px-4.5 pt-2 pb-4.5"
      >
        <div className="mx-auto mt-1 mb-3 h-1.25 w-10 rounded bg-[#d5d8e0]" />
        {children}
      </div>
    </>
  );
}

type Creds = { email: string; password: string } | null;
const label = "mb-1.5 block text-[13.5px] text-muted";

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <button
          type="button"
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={`rounded-xl border px-2 py-3 text-[15px] ${
            value === r ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line"
          }`}
        >
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function AddForm({ onDone }: { onDone: (r: ActionResult, creds: Creds) => void }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("commercial");
  const [password, setPassword] = useState(generatePassword);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addMembre({ nom, email, role, password });
          onDone(r, r.ok && r.accountCreated ? { email: email.trim().toLowerCase(), password } : null);
        });
      }}
    >
      <h2 className="mb-3.5 text-xl font-bold">Ajouter un compte</h2>
      <label className="mb-3 block">
        <span className={label}>Prénom</span>
        <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Lamia" autoFocus />
      </label>
      <label className="mb-3 block">
        <span className={label}>Email</span>
        <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@mcaisse.fr" autoComplete="off" />
      </label>
      <span className={label}>Rôle</span>
      <RolePicker value={role} onChange={setRole} />
      <label className="mb-1.5 block">
        <span className={label}>Mot de passe provisoire</span>
        <div className="flex gap-2">
          <input className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          <button type="button" onClick={() => setPassword(generatePassword())} className="flex-none rounded-xl border border-line px-3.5 text-[14px]">
            Générer
          </button>
        </div>
      </label>
      <p className="mb-4 text-[12.5px] text-muted">
        La personne pourra le changer avec « Mot de passe oublié ». Seuls les commerciaux apparaissent dans les filtres des dossiers.
      </p>
      <button disabled={pending} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {pending ? "Création…" : "Créer le compte"}
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
  onDone: (r: ActionResult, creds: Creds) => void;
}) {
  const [role, setRole] = useState<Role>(membre.role);
  const [pending, start] = useTransition();

  return (
    <div>
      <h2 className="text-xl font-bold">{membre.nom}</h2>
      <p className="mb-4 text-[14px] text-muted">{membre.email}</p>

      <span className={label}>Rôle</span>
      <RolePicker value={role} onChange={setRole} />
      <button
        disabled={pending || role === membre.role}
        onClick={() => start(async () => onDone(await updateRole(membre.id, role), null))}
        className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-40"
      >
        Enregistrer le rôle
      </button>

      {membre.hasAccount && (
        <button
          disabled={pending}
          onClick={() => {
            const pwd = generatePassword();
            if (!confirm(`Remplacer le mot de passe de ${membre.nom} par un nouveau mot de passe provisoire ?`)) return;
            start(async () => onDone(await resetPassword(membre.email, pwd), { email: membre.email, password: pwd }));
          }}
          className="mt-2 w-full rounded-2xl border border-line py-4 font-bold disabled:opacity-60"
        >
          Nouveau mot de passe
        </button>
      )}

      {!isMe && (
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm(`Supprimer le compte de ${membre.nom} ? Il (elle) ne pourra plus se connecter. Ses dossiers sont conservés.`)) return;
            start(async () => onDone(await deleteMembre(membre.id), null));
          }}
          className="mt-2 w-full rounded-2xl py-4 font-bold text-danger disabled:opacity-60"
        >
          Supprimer le compte
        </button>
      )}
    </div>
  );
}
