"use client";

import { useEffect, useRef, useState } from "react";
import { useStudioProject } from "./StudioProjectProvider";

/** A project change hydrates once; typing never gets overwritten by its own save echo. */
export function useProductionDraft<T>(tool: string, initial: T, read: (value: unknown) => value is T, seed?: () => T, normalize?: (value: T) => T) {
  const { project, ready, saveDraft } = useStudioProject();
  const [value, setValue] = useState<T>(initial);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loaded = useRef<string | null>(null);
  const saved = useRef("");
  const saveRef = useRef(saveDraft); saveRef.current = saveDraft;
  useEffect(() => {
    if (!ready || !project || loaded.current === project.id) return;
    loaded.current = project.id;
    const stored = project.drafts[tool];
    const source = read(stored) ? stored : project.example === "velune" && seed ? seed() : initial;
    const next = normalize ? normalize(source) : source;
    saved.current = read(stored) ? JSON.stringify(stored) : "";
    setValue(next); setLoadedId(project.id); setError("");
  }, [ready, project, tool, initial, read, seed, normalize]);
  useEffect(() => {
    if (!project || loadedId !== project.id) return;
    const encoded = JSON.stringify(value);
    if (encoded === saved.current) return;
    saved.current = encoded;
    const targetId = project.id;
    void saveRef.current(tool, value).catch(() => { if (loaded.current === targetId) { saved.current = ""; setError("This draft could not be saved on this device. Export it before leaving."); } });
  }, [value, tool, loadedId, project?.id]);
  async function flush() {
    await saveRef.current(tool, value);
    setError("");
  }
  return { value, setValue, loaded: ready && !!project && loadedId === project.id, error, flush };
}
