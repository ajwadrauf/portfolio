"use client";

import { useRef, useState } from "react";
import type { AdLabSeed, AdSceneCard } from "@/lib/adDraft";

export function AdSceneBoard({ cards, onChange, references, duration, onApply }: { cards: AdSceneCard[]; onChange: (cards: AdSceneCard[]) => void; references: AdLabSeed["references"]; duration: number; onApply: (text: string) => void }) {
  const [selected, setSelected] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  function selectScene(next: number) { setSelected(next); strip.current?.children[next]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); }
  const index = Math.min(selected, Math.max(0, cards.length - 1)); const scene = cards[index];
  const update = (change: Partial<AdSceneCard>) => onChange(cards.map((card, i) => i === index ? { ...card, ...change } : card));
  const invalid = cards.some((card, i) => card.start < 0 || card.end <= card.start || card.end > duration || (i > 0 && Math.abs(card.start - cards[i - 1].end) > 0.01)) || (cards.length > 0 && (cards[0].start !== 0 || Math.abs(cards[cards.length - 1].end - duration) > 0.01));
  return <section className="my-6 rounded-xl border border-border-soft p-4 sm:p-6" aria-labelledby="scene-board-title">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">Picture & sound at a glance</p><h2 id="scene-board-title" className="mt-1 text-2xl tracking-tight">Scene board</h2></div><span className="font-mono text-xs text-muted">{cards.length} scenes · {duration}s cut</span></div>
    <p className="mt-2 text-xs leading-relaxed text-muted">Review action, camera, attached references and intended sound together. Recipe timings start evenly spaced; VELUNE uses its supplied 24 fps edit. An imported prompt without shot data starts as one planning block. Board edits stay in this draft until you apply them to the prompt.</p>
    <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted">Scroll through the cut · select a shot to edit</p><div className="flex gap-2"><button className="btn-secondary !px-3" aria-label="Previous scene" disabled={index === 0} onClick={() => selectScene(index - 1)}>←</button><button className="btn-secondary !px-3" aria-label="Next scene" disabled={index >= cards.length - 1} onClick={() => selectScene(index + 1)}>→</button></div></div>
    <div ref={strip} className="mt-3 flex gap-3 overflow-x-auto pb-3">{cards.map((card, i) => {
      const image = card.referenceIds.map((id) => references.find((ref) => ref.id === id && ref.kind === "image")).find(Boolean);
      return <button type="button" key={card.id} aria-pressed={i === index} onClick={() => selectScene(i)} className={`w-[230px] shrink-0 overflow-hidden rounded-lg border text-left ${i === index ? "border-accent ring-1 ring-accent" : "border-border-soft"}`}>
        <div className="relative flex aspect-video items-center justify-center bg-surface-2">{image ? <img src={image.dataUrl ?? image.url} alt={image.name} className="h-full w-full object-contain" /> : <span className="px-3 text-center text-xs text-muted">No scene still attached</span>}<span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-1 font-mono text-[10px]">{card.start.toFixed(2)}–{card.end.toFixed(2)}s</span></div>
        <div className="p-3"><p className="text-sm font-semibold">{i + 1}. {card.title}</p><p className="mt-1 line-clamp-3 text-xs text-muted">{card.action}</p><p className="mt-2 line-clamp-2 text-[11px] text-muted">Camera · {card.camera || "Needs direction"}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted">Sound · {card.sound || "Not planned"}</p></div>
      </button>;
    })}</div>
    {scene && <details className="mt-4 rounded-lg border border-border-soft p-4"><summary className="cursor-pointer text-sm font-semibold">Edit scene {index + 1} · {scene.title}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className="label">Scene title</span><input className="input mt-1" value={scene.title} maxLength={150} onChange={(e) => update({ title: e.target.value })} /></label>
      <label><span className="label">Start · seconds</span><input type="number" min={0} max={duration} step={0.01} className="input mt-1" value={Number(scene.start.toFixed(3))} onChange={(e) => update({ start: Number(e.target.value) })} /></label>
      <label><span className="label">End · seconds</span><input type="number" min={0} max={duration} step={0.01} className="input mt-1" value={Number(scene.end.toFixed(3))} onChange={(e) => update({ end: Number(e.target.value) })} /></label>
      <label><span className="label">Action</span><textarea className="input mt-1" maxLength={6000} value={scene.action} onChange={(e) => update({ action: e.target.value })} /></label>
      <label><span className="label">Camera</span><textarea className="input mt-1" maxLength={1500} value={scene.camera} placeholder="Lens, framing and movement" onChange={(e) => update({ camera: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className="label">Intended sound</span><textarea className="input mt-1" maxLength={1500} value={scene.sound} placeholder="Voice, music, product sound or intentional silence" onChange={(e) => update({ sound: e.target.value })} /></label>
    </div><fieldset className="mt-3"><legend className="label">References for this scene · attachment does not certify coverage</legend><div className="mt-2 flex flex-wrap gap-3">{references.map((ref) => <label key={ref.id} className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={scene.referenceIds.includes(ref.id)} onChange={(e) => update({ referenceIds: e.target.checked ? [...scene.referenceIds, ref.id] : scene.referenceIds.filter((id) => id !== ref.id) })} />{ref.name}</label>)}{references.length === 0 && <p className="text-xs text-muted">Attach references below to assign them here.</p>}</div></fieldset></details>}
    {invalid && <p role="alert" className="mt-3 text-sm text-warning">Check the scene boundaries: they must follow in order, without gaps or overlaps, inside the video duration.</p>}
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={invalid || !cards.length} className="btn-secondary" onClick={() => onApply(cards.map((c) => `${c.start.toFixed(2)}–${c.end.toFixed(2)}s · ${c.title}: ${c.action}\nCamera: ${c.camera || "Follow the supplied reference."}\nSound: ${c.sound || "Follow the sound direction."}`).join("\n\n"))}>Apply scene board to prompt</button>
    <button type="button" className="btn-secondary" disabled={!scene || scene.end - scene.start < 0.1 || cards.length >= 30} onClick={() => { const middle = (scene.start + scene.end) / 2; onChange([...cards.slice(0, index), { ...scene, end: middle }, { ...scene, id: crypto.randomUUID(), title: `${scene.title.slice(0, 140)} · next`, start: middle }, ...cards.slice(index + 1)]); setSelected(index + 1); }}>Split selected scene</button>
    <button type="button" className="btn-secondary" disabled={cards.length <= 1} onClick={() => { const next = cards.filter((_, i) => i !== index).map((card) => ({ ...card })); if (index > 0) next[index - 1].end = scene.end; else next[0].start = scene.start; onChange(next); setSelected(Math.max(0, index - 1)); }}>Merge into adjacent scene</button></div>
  </section>;
}
