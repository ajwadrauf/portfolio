"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createStudioProject, deleteStudioProject, listStudioProjects, loadStudioProject, newStudioProject, patchStudioProject, projectSummary, STUDIO_ACTIVE_KEY, STUDIO_PROJECT_EVENT, type StudioAsset, type StudioProject, type StudioProjectSummary } from "@/lib/studioProjects";

type Workspace = {
  project: StudioProject | null; projects: StudioProjectSummary[]; ready: boolean; error: string | null;
  saveDraft: (tool: string, data: unknown) => Promise<void>;
  saveAsset: (asset: StudioAsset) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  renameProject: (name: string) => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  createProject: (name: string, example?: "velune") => Promise<void>;
  importProject: (project: StudioProject) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
};
const Context = createContext<Workspace | null>(null);
// Strict Mode mounts twice in development. Share only the pending initialization,
// so both mounts cannot create a first project before either transaction finishes.
let initialization: Promise<{ all: StudioProjectSummary[]; selected: StudioProject }> | null = null;
function initialProject() {
  if (!initialization) initialization = (async () => {
    const all = await listStudioProjects();
    let saved: string | null = null;
    try { saved = localStorage.getItem(STUDIO_ACTIVE_KEY); } catch {}
    const summary = all.find((p) => p.id === saved) ?? all[0];
    const selected = summary ? await loadStudioProject(summary.id) : await createStudioProject(newStudioProject("My first project"));
    if (!selected) throw new Error("The selected project could not be opened.");
    return { all, selected };
  })().finally(() => { initialization = null; });
  return initialization;
}

export function StudioProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const pendingSelection = useRef(0);
  const accept = useCallback((p: StudioProject) => {
    activeRef.current = p.id; setProject(p); setError(null);
    try { localStorage.setItem(STUDIO_ACTIVE_KEY, p.id); } catch { /* IndexedDB is the durable source. */ }
    setProjects((previous) => [projectSummary(p), ...previous.filter((item) => item.id !== p.id)]);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { all, selected } = await initialProject();
        if (!cancelled) { setProjects(all); accept(selected); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Project storage could not open."); }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [accept]);

  // Closures capture the original project id: an in-flight job cannot land in a newly selected project.
  const id = project?.id;
  const patch = useCallback(async (changes: Parameters<typeof patchStudioProject>[1]) => {
    if (!id) throw new Error("Create or open a project before saving.");
    try {
      const next = await patchStudioProject(id, changes);
      if (activeRef.current === id) setProject((p) => p?.id === id ? next : p);
      setProjects((all) => [projectSummary(next), ...all.filter((p) => p.id !== id)]);
      setError(null);
      window.dispatchEvent(new CustomEvent(STUDIO_PROJECT_EVENT, { detail: { id } }));
    } catch (e) { setError(e instanceof Error ? e.message : "The project could not be saved."); throw e; }
  }, [id]);
  const saveDraft = useCallback((tool: string, data: unknown) => patch({ tool, draft: data }), [patch]);
  const saveAsset = useCallback((asset: StudioAsset) => patch({ asset }), [patch]);
  const removeAsset = useCallback((removeAssetId: string) => patch({ removeAssetId }), [patch]);
  const renameProject = useCallback((name: string) => patch({ name }), [patch]);
  const selectProject = useCallback(async (nextId: string) => {
    const revision = ++pendingSelection.current;
    const p = await loadStudioProject(nextId);
    if (!p) throw new Error("This project is no longer on this device.");
    if (revision === pendingSelection.current) accept(p);
  }, [accept]);
  const createProject = useCallback(async (name: string, example?: "velune") => {
    const revision = ++pendingSelection.current;
    const p = await createStudioProject(newStudioProject(name, example));
    if (revision === pendingSelection.current) accept(p);
  }, [accept]);
  const importProject = useCallback(async (p: StudioProject) => {
    const revision = ++pendingSelection.current;
    const created = await createStudioProject(p);
    if (revision === pendingSelection.current) accept(created);
  }, [accept]);
  const removeProject = useCallback(async (removedId: string) => {
    const revision = ++pendingSelection.current;
    await deleteStudioProject(removedId);
    const remaining = await listStudioProjects(); setProjects(remaining);
    if (activeRef.current === removedId && revision === pendingSelection.current) {
      const next = remaining[0] ? await loadStudioProject(remaining[0].id) : await createStudioProject(newStudioProject("New project"));
      if (next && revision === pendingSelection.current) accept(next);
    }
  }, [accept]);
  return <Context.Provider value={{ project, projects, ready, error, saveDraft, saveAsset, removeAsset, renameProject, selectProject, createProject, importProject, removeProject }}>{children}</Context.Provider>;
}

export function useStudioProject(): Workspace {
  const value = useContext(Context);
  if (!value) throw new Error("Studio tools must be inside StudioProjectProvider.");
  return value;
}
