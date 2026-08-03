"use client";

import { Dialog } from "@/components/hub/dialog";
import { useHub } from "@/components/hub/hub-provider";
import {
  MenuItem,
  MenuSeparator,
  PopoverMenu,
} from "@/components/hub/popover-menu";
import {
  LUCIDE_PREFIX,
  SPACE_ICON_GROUPS,
} from "@/components/hub/space-icon";
import { content, type SpaceProfile } from "@/lib/data";
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  Folder,
  FolderSync,
  Image as ImageIcon,
  Palette,
  Pencil,
  Settings2,
  Share,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const THEME_COLORS = [
  "#4353ff", "#16a34a", "#d97706", "#db2777",
  "#0891b2", "#7c3aed", "#dc2626", "#0ea5e9",
];

type View = "root" | "icon" | "theme" | "profile" | "live";
type DialogKind = null | "rename" | "delete";

/** Space context menu ("…" next to the space name) — fully functional. */
export function SpaceMenu({
  open,
  onClose,
  spaceId,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  className?: string;
}): ReactNode {
  const hub = useHub();
  const copy = content.spaceMenu;
  const [view, setView] = useState<View>("root");
  const [dialog, setDialog] = useState<DialogKind>(null);

  const space = hub.spaces.find((s) => s.id === spaceId);

  const close = (): void => {
    setView("root");
    onClose();
  };
  const openDialog = (kind: DialogKind): void => {
    setDialog(kind);
    close();
  };

  const liveOptions = [
    { title: copy.liveRecentDownloads, icon: Download },
    { title: copy.liveTodaysTabs, icon: Clock },
    { title: copy.liveFavorites, icon: Star },
  ];
  const profileOptions: { value: SpaceProfile; label: string }[] = [
    { value: "personal", label: copy.profilePersonal },
    { value: "work", label: copy.profileWork },
    { value: "shared", label: copy.profileShared },
  ];

  return (
    <>
      <PopoverMenu
        open={open}
        onClose={close}
        label="Profile options"
        className={className}
      >
        {view === "root" && (
          <>
            <MenuItem
              icon={ImageIcon}
              label={copy.changeIcon}
              hasSubmenu
              onClick={() => setView("icon")}
            />
            <MenuItem
              icon={Pencil}
              label={copy.rename}
              onClick={() => openDialog("rename")}
            />
            <MenuItem
              icon={Palette}
              label={copy.editTheme}
              hasSubmenu
              onClick={() => setView("theme")}
            />
            <MenuItem
              icon={UserRound}
              label={copy.setProfile}
              hasSubmenu
              onClick={() => setView("profile")}
            />
            <MenuSeparator />
            <MenuItem
              icon={Folder}
              label={copy.newFolder}
              onClick={() => {
                hub.addSpaceFolder(spaceId);
                close();
              }}
            />
            <MenuItem
              icon={FolderSync}
              label={copy.liveFolders}
              hasSubmenu
              onClick={() => setView("live")}
            />
            <MenuSeparator />
            <MenuItem
              icon={Share}
              label={copy.shareSpace}
              onClick={() => {
                hub.openShare();
                close();
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={Settings2}
              label={copy.manageSpaces}
              onClick={() => {
                hub.openProfilesManager();
                close();
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={Trash2}
              label={copy.deleteSpace}
              destructive
              onClick={() => openDialog("delete")}
            />
          </>
        )}

        {view !== "root" && (
          <SubPanelHeader
            title={
              view === "icon"
                ? copy.iconPanelTitle
                : view === "theme"
                  ? copy.themePanelTitle
                  : view === "profile"
                    ? copy.profilePanelTitle
                    : copy.liveFoldersPanelTitle
            }
            onBack={() => setView("root")}
          />
        )}

        {view === "icon" && (
          <div className="max-h-72 overflow-y-auto p-1">
            {SPACE_ICON_GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-1 pt-1 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {group.icons.map(({ name, Icon }) => {
                    const value = `${LUCIDE_PREFIX}${name}`;
                    const selected = space?.emoji === value;
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-label={`Set icon ${name}`}
                        onClick={() => {
                          hub.setSpaceEmoji(spaceId, value);
                          close();
                        }}
                        className={`focus-ring flex aspect-square items-center justify-center rounded-lg hover:bg-surface-hover ${
                          selected
                            ? "bg-accent/15 text-accent"
                            : "text-foreground"
                        }`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "theme" && (
          <div className="grid grid-cols-4 gap-2 p-2">
            {THEME_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Set theme color ${color}`}
                onClick={() => {
                  hub.setSpaceThemeColor(spaceId, color);
                  close();
                }}
                className="focus-ring flex aspect-square items-center justify-center rounded-lg"
                style={{ backgroundColor: color }}
              >
                {(space?.themeColor ?? "#4353ff") === color && (
                  <Check className="size-4 text-white" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        )}

        {view === "profile" && (
          <div className="p-1">
            {profileOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  hub.setSpaceProfile(spaceId, option.value);
                  close();
                }}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover"
              >
                <span className="flex-1">{option.label}</span>
                {space?.profile === option.value && (
                  <Check
                    className="size-4 text-accent"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {view === "live" && (
          <div className="p-1">
            {liveOptions.map((option) => (
              <button
                key={option.title}
                type="button"
                onClick={() => {
                  hub.addLiveFolder(spaceId, option.title, "Folder");
                  close();
                }}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-hover"
              >
                <option.icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1">{option.title}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverMenu>

      <RenameDialog
        open={dialog === "rename"}
        onClose={() => setDialog(null)}
        currentName={space?.name ?? ""}
        onSave={(name) => hub.renameSpace(spaceId, name)}
      />
      <DeleteDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => hub.deleteSpace(spaceId)}
        canDelete={hub.spaces.length > 1}
      />
    </>
  );
}

function SubPanelHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}): ReactNode {
  return (
    <div className="flex items-center gap-1 px-1 pb-1">
      <button
        type="button"
        onClick={onBack}
        aria-label={content.spaceMenu.back}
        className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="text-xs font-semibold text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

function RenameDialog({
  open,
  onClose,
  currentName,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (name: string) => void;
}): ReactNode {
  const copy = content.spaceMenu;
  const submit = (value: string): void => {
    if (value.trim()) onSave(value);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} label={copy.renameTitle}>
      <form
        className="p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem(
            "space-name",
          ) as HTMLInputElement | null;
          submit(input?.value ?? "");
        }}
      >
        <h2 className="text-base font-semibold">{copy.renameTitle}</h2>
        <input
          name="space-name"
          autoFocus
          defaultValue={currentName}
          aria-label={copy.renameTitle}
          className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            {copy.renameCancel}
          </button>
          <button
            type="submit"
            className="focus-ring rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            {copy.renameSave}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onClose,
  onConfirm,
  canDelete,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  canDelete: boolean;
}): ReactNode {
  const copy = content.spaceMenu;
  return (
    <Dialog open={open} onClose={onClose} label={copy.deleteTitle}>
      <div className="p-6">
        <h2 className="text-base font-semibold">{copy.deleteTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {canDelete
            ? copy.deleteBody
            : "You can't delete your only profile."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            {copy.deleteCancel}
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="focus-ring rounded-full bg-negative px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {copy.deleteConfirm}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

