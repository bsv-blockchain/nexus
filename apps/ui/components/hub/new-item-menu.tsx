"use client";

import { useHub } from "@/components/hub/hub-provider";
import { useCreateWorkspace } from "@/components/hub/use-create-workspace";
import {
  MenuItem,
  MenuSeparator,
  PopoverMenu,
} from "@/components/hub/popover-menu";
import { content } from "@/lib/data";
import { Copy, Folder, Plus } from "lucide-react";
import type { ReactNode } from "react";

/** "+" popover: New Space / Folder / Split / Tab. */
export function NewItemMenu({
  open,
  onClose,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
}): ReactNode {
  const createWorkspace = useCreateWorkspace();
  const { setCommandPaletteOpen, addSpaceFolder, activeSpaceId } =
    useHub();
  const copy = content.newItemMenu;

  return (
    <PopoverMenu
      open={open}
      onClose={onClose}
      label="New item"
      className={className}
    >
      <MenuItem
        icon={Copy}
        label={copy.newSpace}
        onClick={() => {
          createWorkspace();
          onClose();
        }}
      />
      <MenuItem
        icon={Folder}
        label={copy.newFolder}
        onClick={() => {
          addSpaceFolder(activeSpaceId);
          onClose();
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={Plus}
        label={copy.newTab}
        shortcut="⌘T"
        onClick={() => {
          onClose();
          setCommandPaletteOpen(true);
        }}
      />
    </PopoverMenu>
  );
}
