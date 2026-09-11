"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useStudioProject } from "./StudioProjectProvider";
import { downloadStudioFile, portableProject, PROJECT_MAX_BYTES, validateStudioProject } from "@/lib/studioProjects";
import { VELUNE_REFERENCES } from "@/lib/veluneReferences";

export function VeluneExampleButton({ className = "btn-secondary" }: { className?: string }) {
  const { createProject, ready } = useStudioProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <span><button type="button" className={className} disabled={!ready || busy} onClick={async () => {
    setBusy(true); setError("");
    try { await createProject("VELUNE · working copy", "velune"); } catch (e) { setError(e instanceof Error ? e.message : "Could not load the example."); }
    finally { setBusy(false); }
  }}>{busy ? "Loading example…" : "Load VELUNE example"}<span aria-hidden> ↗</span></button>{error && <span role="alert" className="mt-2 block text-sm text-danger">{error}</span>}</span>;
}

export function ProjectDock() {
  const { project, projects, ready, error, selectProject, createProject, renameProject, importProject } = useStudioProject();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : "The project could not be updated."); }
    finally { setBusy(false); }
  };
  return <div className="border-b border-border-soft bg-surface" aria-label="Current studio project">
    <div className="mx-auto max-w-6xl px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-sm">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer py-1.5"><span className="label-sm mr-2">Project</span><strong>{project?.name ?? (ready ? "Storage unavailable" : "Opening projects…")}</strong><span className="ml-2 text-xs text-muted">On this device</span></summary>
          <div className="my-3 grid gap-3 rounded-md border border-border-soft p-4 sm:grid-cols-2">
            <label className="text-sm">Open a project<select className="input mt-1" value={project?.id ?? ""} disabled={!ready || busy} onChange={(e) => void action(() => selectProject(e.target.value))}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="text-sm">Project name<input className="input mt-1" value={name} placeholder={project?.name ?? "New project"} maxLength={100} onChange={(e) => setName(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" className="btn-secondary" disabled={busy || !name.trim()} onClick={() => void action(() => createProject(name))}>Create project</button>
              <button type="button" className="btn-secondary" disabled={busy || !project || !name.trim()} onClick={() => void action(() => renameProject(name))}>Rename current</button>
              <button type="button" className="btn-secondary" disabled={!project} onClick={() => project && downloadStudioFile(`${project.name.replace(/[^a-z0-9-]/gi, "-")}.studio.json`, JSON.stringify(portableProject(project), null, 2))}>Export project</button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>Import project</button>
              <input ref={fileRef} type="file" accept=".json" aria-label="Import studio project JSON" className="sr-only" onChange={(e) => {
                const file = e.target.files?.[0]; e.target.value = "";
                if (file) void action(async () => {
                  if (file.size > PROJECT_MAX_BYTES) throw new Error("Choose a project file smaller than 100 MB.");
                  const p = portableProject(validateStudioProject(JSON.parse(await file.text())));
                  await importProject({ ...p, id: crypto.randomUUID(), name: `${p.name.slice(0, 84)} · imported`, createdAt: Date.now(), updatedAt: Date.now() });
                });
              }} />
            </div>
            <p className="text-xs leading-relaxed text-muted sm:col-span-2">Drafts and selected assets stay in this browser. Export a copy before clearing site data. Imported projects never resume paid requests. Large provider-hosted media may need downloading separately before its link expires.</p>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3"><Link href="/ai-studio/projects" className="inline-flex min-h-9 items-center font-semibold text-accent underline underline-offset-4">Project & assets ↗</Link><VeluneExampleButton className="btn-secondary !px-3 !py-2 text-xs" /></div>
      </div>
      {project?.example === "velune" && <p className="mt-2 text-xs text-muted">VELUNE working copy · {VELUNE_REFERENCES.filter((ref) => project.assets.some((a) => a.id === ref.id && a.status === "ready")).length}/8 visual references · Blender camera study · {project.assets.some((a) => a.id === "velune-final" && a.status === "ready") ? "Final film attached to this project" : "Final Seedance film pending"}. Loading an example never generates or spends.</p>}
      {(error || message) && <p role="alert" className="mt-2 text-sm text-danger">{message || error}</p>}
    </div>
  </div>;
}
