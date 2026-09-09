"use client";

import { useEffect, useRef, useState } from "react";

export type AudioJob = { requestId: string; modelId: "eleven-music" | "eleven-sfx" | "eleven-voice"; label: string; seconds: number; cost: number; audioUrl?: string };
type AudioResult = { audioUrl: string; mock: boolean };
const STORAGE = "adlab-audio-jobs-v1";

/** Keep accepted job handles before polling, so a timeout/reload never requires a new paid request. */
export function useAudioJobs(onSpend: (cost: number) => void) {
  const [jobs, setJobs] = useState<AudioJob[]>([]);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
      if (Array.isArray(saved)) setJobs(saved.filter((j) => typeof j?.requestId === "string" && ["eleven-music", "eleven-sfx", "eleven-voice"].includes(j.modelId)).slice(-20));
    } catch { /* Storage is optional; request IDs remain visible in this tab. */ }
    return () => controller.current?.abort();
  }, []);

  const remember = (job: AudioJob) => setJobs((previous) => {
    const next = [...previous.filter((j) => j.requestId !== job.requestId), job].slice(-20);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* Private browsing can refuse storage. */ }
    return next;
  });

  const collect = async (job: AudioJob, signal: AbortSignal): Promise<AudioResult> => {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      let result: { status?: string; audioUrl?: string; error?: string } | undefined;
      try {
        const response = await fetch("/api/ad/audio/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: job.requestId, modelId: job.modelId }), signal });
        if (response.ok) result = await response.json();
      } catch { signal.throwIfAborted(); }
      if (result?.status === "done" && result.audioUrl) {
        remember({ ...job, audioUrl: result.audioUrl });
        return { audioUrl: result.audioUrl, mock: false };
      }
      if (result?.status === "failed") throw new Error(result.error ?? "The audio job failed. Its request ID is saved below.");
      await new Promise<void>((resolve) => setTimeout(resolve, 2500));
    }
    throw new Error("Audio is taking longer than expected. Use Check result in Audio requests below; it checks the saved job without buying another generation.");
  };

  const run = async (path: "/api/ad/music" | "/api/ad/sfx" | "/api/ad/voice", body: unknown, label: string): Promise<AudioResult> => {
    if (active.current) throw new Error("Wait for the current audio request before starting another.");
    active.current = true; setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      // Never retry a submission automatically: an uncertain response may already be billed.
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Audio submission failed");
      if (result.mock && result.audioUrl) return { audioUrl: result.audioUrl, mock: true };
      if (!result.requestId) throw new Error("No audio request ID was returned. Check fal history before submitting again.");
      const job: AudioJob = { requestId: result.requestId, modelId: result.modelId, seconds: result.seconds, cost: result.cost, label };
      remember(job); onSpend(job.cost ?? 0);
      return await collect(job, abort.signal);
    } finally { active.current = false; setBusy(false); }
  };

  const resume = async (job: AudioJob) => {
    if (active.current) throw new Error("Wait for the current audio request first.");
    active.current = true; setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try { return await collect(job, abort.signal); }
    finally { active.current = false; setBusy(false); }
  };

  return { jobs, busy, run, resume };
}
