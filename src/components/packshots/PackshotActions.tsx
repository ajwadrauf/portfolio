"use client";
import { useRef, useState } from "react";
import { CampaignHandoffButton } from "./CampaignHandoffButton";
import { blobToCampaignDataUrl, sourceImage, type CampaignPackshotMeta } from "@/lib/campaignHandoff";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";

export function PackshotActions(props: { source: string; meta: CampaignPackshotMeta; disabled?: boolean; label?: string }) {
  const { project, saveAsset } = useStudioProject();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function keep() {
    if (!project || props.disabled || lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    const save = saveAsset, projectName = project.name;
    try {
      const dataUrl = await blobToCampaignDataUrl(await sourceImage(props.source));
      await save({ id: crypto.randomUUID(), name: props.meta.name, kind: "image", dataUrl, source: props.meta.source === "generated" ? "generated" : "uploaded", status: "ready", role: `Completed packshot · ${props.meta.angle} · ${props.meta.review}`, metadata: { ...props.meta, savedAt: new Date().toISOString() } });
      setMessage(`Saved in ${projectName}. Available in the project’s reference selectors.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "The completed view could not be saved."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><CampaignHandoffButton {...props} /><button type="button" className="btn-secondary mt-3 w-full" disabled={!project || props.disabled || busy} onClick={() => void keep()}>{busy ? "Saving completed view…" : "Keep in project assets"}</button>{message && <p className="mt-2 text-sm text-muted" role="status">{message}</p>}</>;
}
