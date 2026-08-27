"use client";

import { useMemo, useState } from "react";

/**
 * The checklist, tickable.
 *
 * A governance section that can only be read is a section people skim. This
 * one is meant to be run against an actual asset, so it keeps state, counts
 * what is outstanding, and refuses to look finished until it is. Nothing is
 * persisted — it resets per asset on purpose, because a checklist that
 * remembers last time is worse than no checklist.
 */
export function PreflightChecklist({
  groups,
}: {
  groups: { group: string; items: string[] }[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const total = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );
  const complete = done.size === total;

  const toggle = (key: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-3">
        <span
          className={`label-sm ${complete ? "!text-success" : done.size ? "!text-accent" : ""}`}
        >
          {done.size} of {total} cleared
        </span>
        {done.size > 0 && (
          <button
            className="text-xs font-semibold text-muted transition hover:text-foreground"
            onClick={() => setDone(new Set())}
          >
            Reset for the next asset
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="label !text-accent">{g.group}</p>
            <ul className="mt-3 space-y-2">
              {g.items.map((item) => {
                const key = `${g.group}::${item}`;
                const checked = done.has(key);
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                        checked={checked}
                        onChange={() => toggle(key)}
                      />
                      <span
                        className={`text-sm leading-relaxed transition ${
                          checked ? "text-muted line-through" : "text-foreground"
                        }`}
                      >
                        {item}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p
        className={`mt-6 rounded-[6px] border p-3 text-sm leading-relaxed ${
          complete
            ? "border-success/40 bg-success/[0.06] text-success"
            : "border-border-soft bg-surface-2 text-muted"
        }`}
      >
        {complete
          ? "Cleared. The provenance record is the thing that makes this defensible six months from now, so file it before you move on."
          : "Anything left unticked is a question someone will ask later, when it is more expensive to answer."}
      </p>
    </div>
  );
}
