"use client";

import { MemberAvatar } from "@/components/apps/messages/member-avatar";
import type { MessagePerson } from "@/lib/data";
import type { ReactNode } from "react";

/**
 * A group's picture, built from who is in it.
 *
 * One rounded square, divided by member count: two split it down the middle,
 * three take three quadrants, four take all four, and beyond that three faces
 * plus a count. Every layout fills the same square, so a list of conversations
 * keeps one rhythm whether a row is a person or a group.
 *
 * The count is capped at `+9`, because past that the exact number stops being
 * information and the tile only has so much room.
 */
export function GroupAvatar({
  members,
  size,
  icon,
  className = "",
}: {
  members: MessagePerson[];
  size: number;
  /** the room's own picture, which stands in for the mosaic when set */
  icon?: string | undefined;
  className?: string;
}): ReactNode {
  const radius = Math.max(6, Math.round(size * 0.28));

  if (icon) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-cover ${className}`}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const gap = 1;
  const half = (size - gap) / 2;

  const shown =
    members.length <= 4 ? members.slice(0, 4) : members.slice(0, 3);
  const overflow = members.length > 4 ? members.length - 3 : 0;

  /**
   * One cell of the mosaic. The avatar is sized to the cell's longer edge and
   * centred, so a square portrait fills a half or a quarter without
   * letterboxing, and squared off because the tile owns the rounding.
   */
  const cell = (
    person: MessagePerson,
    key: string,
    style: React.CSSProperties,
  ): ReactNode => {
    const cover = Math.ceil(
      Math.max(Number(style.width ?? 0), Number(style.height ?? 0)),
    );
    return (
      <span
        key={key}
        className="absolute grid place-items-center overflow-hidden bg-surface"
        style={style}
      >
        <MemberAvatar person={person} size={cover} radius={0} />
      </span>
    );
  };

  const cells: ReactNode[] = [];

  if (shown.length === 1 && shown[0]) {
    return <MemberAvatar person={shown[0]} size={size} className={className} />;
  }

  if (shown.length === 2) {
    // Split vertically: two halves, side by side.
    if (shown[0]) {
      cells.push(cell(shown[0], "a", { left: 0, top: 0, width: half, height: size }));
    }
    if (shown[1]) {
      cells.push(
        cell(shown[1], "b", { right: 0, top: 0, width: half, height: size }),
      );
    }
  } else if (shown.length === 3 && overflow === 0) {
    // Top-left, top-right, bottom-left. The fourth quadrant is left empty but
    // still painted, so it reads as a vacant cell rather than a block of the
    // divider colour showing through.
    if (shown[0]) cells.push(cell(shown[0], "a", { left: 0, top: 0, width: half, height: half }));
    if (shown[1]) cells.push(cell(shown[1], "b", { right: 0, top: 0, width: half, height: half }));
    if (shown[2]) cells.push(cell(shown[2], "c", { left: 0, bottom: 0, width: half, height: half }));
    cells.push(
      <span
        key="empty"
        className="absolute bg-surface"
        style={{ right: 0, bottom: 0, width: half, height: half }}
      />,
    );
  } else {
    const spots: React.CSSProperties[] = [
      { left: 0, top: 0, width: half, height: half },
      { right: 0, top: 0, width: half, height: half },
      { left: 0, bottom: 0, width: half, height: half },
      { right: 0, bottom: 0, width: half, height: half },
    ];
    shown.forEach((person, index) => {
      const spot = spots[index];
      if (spot) cells.push(cell(person, person.id, spot));
    });
    if (overflow > 0) {
      cells.push(
        <span
          key="overflow"
          className="absolute grid place-items-center bg-surface font-bold text-muted-foreground"
          style={{ ...spots[3], fontSize: Math.max(9, Math.round(size * 0.24)) }}
        >
          +{Math.min(overflow, 9)}
        </span>,
      );
    }
  }

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden bg-border ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {cells}
    </span>
  );
}
