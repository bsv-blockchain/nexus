"use client";

import {
  Bike,
  Bird,
  Briefcase,
  Camera,
  Cat,
  Circle,
  Code,
  Coffee,
  Cpu,
  Database,
  Diamond,
  Dog,
  Dumbbell,
  Fish,
  Gamepad2,
  Hexagon,
  House,
  Laptop,
  Leaf,
  Music,
  Octagon,
  Pentagon,
  Plane,
  Rabbit,
  ShoppingBag,
  Square,
  Star,
  Terminal,
  Triangle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

/** Lucide icons offered in the "Change Space Icon" picker, grouped. */
export const SPACE_ICON_GROUPS: {
  label: string;
  icons: { name: string; Icon: LucideIcon }[];
}[] = [
  {
    label: "Shapes",
    icons: [
      { name: "Circle", Icon: Circle },
      { name: "Square", Icon: Square },
      { name: "Triangle", Icon: Triangle },
      { name: "Diamond", Icon: Diamond },
      { name: "Pentagon", Icon: Pentagon },
      { name: "Hexagon", Icon: Hexagon },
      { name: "Octagon", Icon: Octagon },
      { name: "Star", Icon: Star },
    ],
  },
  {
    label: "Animals",
    icons: [
      { name: "Cat", Icon: Cat },
      { name: "Dog", Icon: Dog },
      { name: "Bird", Icon: Bird },
      { name: "Fish", Icon: Fish },
      { name: "Rabbit", Icon: Rabbit },
    ],
  },
  {
    label: "Tech",
    icons: [
      { name: "Cpu", Icon: Cpu },
      { name: "Code", Icon: Code },
      { name: "Terminal", Icon: Terminal },
      { name: "Database", Icon: Database },
      { name: "Laptop", Icon: Laptop },
    ],
  },
  {
    label: "Lifestyle",
    icons: [
      { name: "House", Icon: House },
      { name: "Coffee", Icon: Coffee },
      { name: "Music", Icon: Music },
      { name: "Camera", Icon: Camera },
      { name: "Plane", Icon: Plane },
      { name: "Bike", Icon: Bike },
      { name: "Dumbbell", Icon: Dumbbell },
      { name: "Gamepad2", Icon: Gamepad2 },
      { name: "ShoppingBag", Icon: ShoppingBag },
      { name: "Briefcase", Icon: Briefcase },
      { name: "Leaf", Icon: Leaf },
    ],
  },
];

const ICON_LOOKUP: Record<string, LucideIcon> = {};
for (const group of SPACE_ICON_GROUPS) {
  for (const icon of group.icons) ICON_LOOKUP[icon.name] = icon.Icon;
}

/** Icon values chosen from the lucide picker are stored with this prefix. */
export const LUCIDE_PREFIX = "lucide:";
/** Sentinel for the default "My Hub" space — renders the Nexus brand mark. */
export const HUB_ICON = "hub";

/**
 * Renders a space's icon. Values prefixed `lucide:` render the matching lucide
 * glyph; any other value (a legacy emoji) is rendered as text.
 */
export function SpaceIcon({
  value,
  size = 16,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}): ReactNode {
  if (value === HUB_ICON) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/icons/nexus.png"
        alt=""
        width={size}
        height={size}
        className={`rounded-[28%] ${className}`}
        aria-hidden="true"
      />
    );
  }
  if (value.startsWith(LUCIDE_PREFIX)) {
    const Icon = ICON_LOOKUP[value.slice(LUCIDE_PREFIX.length)] ?? Circle;
    return (
      <Icon
        style={{ width: size, height: size }}
        className={className}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={className}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {value}
    </span>
  );
}
