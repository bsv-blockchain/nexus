"use client";

/**
 * Who may open Store Admin.
 *
 * Two gates stand in front of this app. Developer mode decides whether an
 * install shows staff surfaces at all; this list decides which identity may
 * use them, and it is enforced rather than described: an identity holding no
 * grant does not get Store Admin in its catalogue, its rail or its search.
 *
 * What it is not is authentication. There is no server to ask and no
 * signature checked, so a determined person with this device can still edit
 * the list. That is stated on the screen rather than papered over, because an
 * access screen that implies more than it does is worse than none at all: it
 * is the one kind of control somebody makes a real decision on the strength
 * of.
 *
 * The two guards worth knowing about: you cannot remove your own access, and
 * the last owner cannot be demoted. An admin screen you can lock yourself out
 * of is one somebody eventually locks themselves out of, with no screen left
 * to fix it from.
 */

import { AdminGroup, ArmedButton, Field, fieldClass } from "@/components/apps/store-admin/blocks";
import { Picker } from "@/components/hub/picker";
import {
  addAccess,
  currentIdentityKey,
  isPublicKey,
  removeAccess,
  roleFor,
  setAccessRole,
  type AccessRole,
  type AdminPromoState,
} from "@/lib/admin-store";
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

const ROLES: { id: AccessRole; label: string; hint: string }[] = [
  { id: "owner", label: "Owner", hint: "Can change this access list" },
  { id: "editor", label: "Editor", hint: "Can change campaigns, surfaces and the catalogue" },
];

const roleOptions = ROLES.map((role) => ({
  id: role.id,
  label: role.label,
  hint: role.hint,
  icon:
    role.id === "owner" ? (
      <ShieldCheck className="text-muted-foreground size-4" aria-hidden="true" />
    ) : (
      <KeyRound className="text-muted-foreground size-4" aria-hidden="true" />
    ),
}));

/** Enough of a key to recognise, without a line that wraps three times. */
function shortKey(publicKey: string): string {
  return `${publicKey.slice(0, 10)}…${publicKey.slice(-6)}`;
}

function addedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AccessTab({ admin }: { admin: AdminPromoState }): ReactNode {
  const me = currentIdentityKey();
  const myRole = roleFor(admin.access, me.publicKey);
  const canManage = myRole === "owner";
  const [publicKey, setPublicKey] = useState("");
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<AccessRole>("editor");

  const keyLooksRight = publicKey.trim().length === 0 || isPublicKey(publicKey);

  const onAdd = (): void => {
    const result = addAccess(publicKey, label, role);
    if (!result.ok) {
      toast.error("Not added", { description: result.reason });
      return;
    }
    toast.success("Access granted", { description: label.trim() || shortKey(publicKey) });
    setPublicKey("");
    setLabel("");
    setRole("editor");
  };

  return (
    <>
      <AdminGroup
        id="access-list"
        title="Who can open Store Admin"
        hint="Enforced on this install: an identity with no grant does not get this app in its catalogue, its rail or its search."
      >
        {admin.access.map((grant) => {
          const mine = grant.publicKey === me.publicKey;
          return (
            <div key={grant.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {grant.label}
                  {mine && (
                    <span className="text-accent ml-2 text-[11px] font-semibold">You</span>
                  )}
                </p>
                <p className="text-muted-foreground font-mono text-[11px]">
                  {shortKey(grant.publicKey)}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Added {addedLabel(grant.addedAt)}
                </p>
              </div>
              <div className="w-40 shrink-0">
                {canManage ? (
                  <Picker
                    label={`Role for ${grant.label}`}
                    value={grant.role}
                    options={roleOptions}
                    onPick={(next) => {
                      const result = setAccessRole(grant.id, next as AccessRole);
                      if (!result.ok) toast.error("Role unchanged", { description: result.reason });
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground text-xs capitalize">{grant.role}</p>
                )}
              </div>
              {canManage && !mine && (
                <ArmedButton
                  label="Revoke"
                  armedLabel="Confirm revoke"
                  onConfirm={() => {
                    const result = removeAccess(grant.id);
                    if (!result.ok) {
                      toast.error("Not revoked", { description: result.reason });
                      return;
                    }
                    toast.success("Access revoked", { description: grant.label });
                  }}
                />
              )}
              {mine && (
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  Your own access stays
                </span>
              )}
            </div>
          );
        })}
      </AdminGroup>

      {canManage ? (
        <AdminGroup
          id="access-add"
          title="Give somebody access"
          hint="Paste the identity key they use on this build. A compressed public key: 02 or 03, then 64 hex characters."
        >
          <div className="grid gap-4 p-3 sm:grid-cols-2">
            <Field label="Name" hint="How this person appears in the list">
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Who this is"
                className={fieldClass}
              />
            </Field>
            <Field label="Role">
              <Picker
                label="Role"
                value={role}
                options={roleOptions}
                onPick={(next) => setRole(next as AccessRole)}
              />
            </Field>
          </div>
          <div className="p-3">
            <Field
              label="Identity key"
              hint={keyLooksRight ? "" : "That is not a compressed public key yet."}
            >
              <input
                value={publicKey}
                onChange={(event) => setPublicKey(event.target.value)}
                placeholder="02…"
                spellCheck={false}
                className={`${fieldClass} font-mono text-xs ${
                  keyLooksRight ? "" : "border-warning"
                }`}
              />
            </Field>
          </div>
          <div className="flex justify-end p-3">
            <button
              type="button"
              disabled={!isPublicKey(publicKey)}
              onClick={onAdd}
              className="focus-ring border-border hover:bg-surface-hover inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              Grant access
            </button>
          </div>
        </AdminGroup>
      ) : (
        <AdminGroup
          id="access-readonly"
          title="Give somebody access"
          hint="Owners only. Your grant is an editor's, which covers campaigns, surfaces and the catalogue but not this list."
        >
          <p className="text-muted-foreground p-3 text-sm text-pretty">
            Ask one of the owners above to add somebody, or to make you an
            owner.
          </p>
        </AdminGroup>
      )}

      <AdminGroup
        id="access-limits"
        title="What this list does and does not do"
        hint="Worth being exact about, since it is the kind of control people make real decisions on."
      >
        <div className="space-y-2 p-3 text-sm text-pretty">
          <p>
            <strong>It does</strong> keep Store Admin out of the catalogue for
            any identity that holds no grant, on top of the developer-mode
            switch that hides staff surfaces entirely.
          </p>
          <p>
            <strong>It does not</strong> authenticate anybody. Nothing here is
            signed and no server is asked, so somebody with this device can
            still reach the list and edit it. Treat it as a roster the product
            honours, not as a lock.
          </p>
          <p>
            Two things it will refuse: removing your own access, and demoting
            the last owner. Both leave a screen nobody can get back into.
          </p>
        </div>
      </AdminGroup>
    </>
  );
}
