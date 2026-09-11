"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { saveCampaignHandoff, type CampaignPackshotMeta } from "@/lib/campaignHandoff";
import styles from "./CampaignHandoffButton.module.css";

type Props = { source: string; meta: CampaignPackshotMeta; disabled?: boolean; label?: string };
type SourceKey = { source: string; metadata: string; disabled: boolean };
type Pending = { controller: AbortController; tab: Window | null; key: SourceKey };

function closeBlankTab(tab: Window | null) {
  try { if (tab && !tab.closed && tab.location.href === "about:blank") tab.close(); } catch { /* Never close a tab the user has navigated elsewhere. */ }
}

export function CampaignHandoffButton({ source, meta, disabled = false, label = "Use in Campaign Studio" }: Props) {
  const metadata = JSON.stringify(meta);
  const key = useMemo(() => ({ source, metadata, disabled }), [source, metadata, disabled]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const pending = useRef<Pending | null>(null);
  const mounted = useRef(true);
  const [state, setState] = useState<{ key: SourceKey; busy?: boolean; href?: string; opened?: boolean; error?: string }>({ key });
  const current = state.key === key ? state : { key };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.controller.abort();
      closeBlankTab(pending.current?.tab ?? null);
      pending.current = null;
    };
  }, []);

  useEffect(() => {
    if (pending.current && pending.current.key !== key) {
      pending.current.controller.abort();
      closeBlankTab(pending.current.tab);
      pending.current = null;
    }
  }, [key]);

  async function send() {
    if (disabled || pending.current) return;
    // Open during the user gesture; asynchronous IndexedDB/fetch completion must not trigger a popup.
    let tab: Window | null = null;
    try {
      tab = window.open("about:blank", "_blank");
      if (tab) {
        tab.opener = null;
        tab.document.title = "Preparing your packshot · Campaign Studio";
        tab.document.body.textContent = "Preparing your completed packshot for Campaign Studio… You can keep working in the Packshots tab.";
      }
    } catch { closeBlankTab(tab); tab = null; }
    const operation: Pending = { controller: new AbortController(), tab, key };
    pending.current = operation;
    setState({ key, busy: true });
    try {
      const record = await saveCampaignHandoff(source, meta, { signal: operation.controller.signal });
      if (!mounted.current || currentKey.current !== key || pending.current !== operation) { closeBlankTab(tab); return; }
      const href = `/ai-studio/studio?packshot=${encodeURIComponent(record.id)}`;
      let opened = false;
      try {
        if (tab && !tab.closed && tab.location.href === "about:blank") {
          tab.location.replace(new URL(href, window.location.origin).href);
          opened = true;
        }
      } catch { /* The prepared link below remains usable if the browser blocks navigation. */ }
      setState({ key, href, opened });
    } catch (error) {
      closeBlankTab(tab);
      if (mounted.current && currentKey.current === key && pending.current === operation) setState({ key, error: error instanceof Error ? error.message : "The packshot could not be prepared. Your completed view is still here; try again." });
    } finally {
      if (pending.current === operation) pending.current = null;
    }
  }

  return <div className={styles.handoff}>
    {current.href && !disabled ? <a className={styles.action} href={current.href} target="_blank" rel="noopener noreferrer">Open in Campaign Studio <span aria-hidden="true">↗</span></a> :
      <button className={styles.action} type="button" disabled={disabled || current.busy} onClick={send}>
        {current.busy ? "Preparing packshot…" : label}<span aria-hidden="true">↗</span>
      </button>}
    <p className={styles.hint} role="status">{current.busy ? "Keeping this view and its details together." : current.href ? (current.opened ? "Opened in a new tab · no generation started" : "Ready · use the link above to open a new tab") : "New tab · no generation started"}</p>
    {current.error && <p className={styles.error} role="alert">{current.error}</p>}
  </div>;
}

export default CampaignHandoffButton;
