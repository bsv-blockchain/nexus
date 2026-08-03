"use client";

import { useHub } from "@/components/hub/hub-provider";
import { content, getCourses } from "@/lib/data";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  GraduationCap,
  PlayCircle,
} from "lucide-react";
import type { ReactNode } from "react";

const ACADEMY_URL = "https://bsvblockchain.360learning.com/home/content/all";

export function LearnApp(): ReactNode {
  const { learnCourse } = useHub();
  const courses = getCourses();
  const copy = content.learn;
  const course = courses.find((c) => c.id === learnCourse) ?? null;

  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        {/* Link out to the full BSV Academy (it can't be embedded). */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl bg-linear-to-br from-[#0ea5e9] to-[#4353ff] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">BSV Academy</h2>
            <p className="mt-1 text-sm text-white/85">
              Full courses, paths and certifications on 360Learning.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              window.open(ACADEMY_URL, "_blank", "noopener,noreferrer")
            }
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1e2a5e] hover:opacity-90"
          >
            Open BSV Academy
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        {course ? (
          <div className="mt-8">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {course.provider} · <span className="capitalize">{course.level}</span>
            </p>
            <h2 className="mt-1 text-2xl font-bold">{course.title}</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.round((course.lessonsCompleted / course.lessonsTotal) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {course.lessonsCompleted}/{course.lessonsTotal}{" "}
                {copy.lessonsLabel}
              </span>
            </div>

            <ul className="mt-5 divide-y divide-border rounded-2xl bg-surface">
              {Array.from({ length: course.lessonsTotal }).map((_, index) => {
                const done = index < course.lessonsCompleted;
                const current = index === course.lessonsCompleted;
                return (
                  <li
                    key={index}
                    className="flex items-center gap-3 px-4 py-3 text-sm"
                  >
                    {done ? (
                      <CheckCircle2
                        className="size-5 shrink-0 text-positive"
                        aria-hidden="true"
                      />
                    ) : current ? (
                      <PlayCircle
                        className="size-5 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`flex-1 ${done ? "text-muted-foreground line-through" : "font-medium"}`}
                    >
                      Lesson {index + 1}
                    </span>
                    {current && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        {copy.continueAction}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <GraduationCap className="size-7" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold">Pick a course to continue</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choose one of your enrolled courses to see its lessons and pick up
              where you left off.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
