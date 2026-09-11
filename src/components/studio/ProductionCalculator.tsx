"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_PRODUCTION_SCENARIO, productionComparison, type ProductionScenario } from "@/lib/studioDecisions";
import { estimateCost } from "@/lib/models";
import { downloadStudioFile } from "@/lib/studioProjects";
import { useStudioProject } from "./StudioProjectProvider";

const FIELDS: { key: keyof ProductionScenario; title: string; min: number; step: number }[] = [
  { key: "accepted", title: "Accepted assets per month", min: 1, step: 1 },
  { key: "attempts", title: "Attempts per accepted asset", min: 1, step: .1 },
  { key: "reviewMinutes", title: "Review minutes per attempt", min: 0, step: .5 },
  { key: "hourlyRate", title: "Review & engineering rate (USD/hour)", min: 0, step: 1 },
  { key: "seats", title: "Suite seats", min: 0, step: 1 },
  { key: "monthlySeat", title: "Suite fee per seat (USD/month)", min: 0, step: 1 },
  { key: "suiteRender", title: "Suite credits per attempt (USD)", min: 0, step: .01 },
  { key: "apiRender", title: "API cost per attempt (USD)", min: 0, step: .01 },
  { key: "maintenanceHours", title: "API maintenance hours/month", min: 0, step: .5 },
  { key: "setupCost", title: "Initial integration cost (USD)", min: 0, step: 100 },
  { key: "amortizationMonths", title: "Spread integration over (months)", min: 1, step: 1 },
];
export function ProductionCalculator() {
  const { project, saveDraft } = useStudioProject();
  const [scenario, setScenario] = useState(DEFAULT_PRODUCTION_SCENARIO);
  const [message, setMessage] = useState("");
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!project || loaded.current === project.id) return;
    loaded.current = project.id;
    const draft = project.drafts.productionCost as ProductionScenario | undefined;
    try { if (draft) { productionComparison(draft); setScenario(draft); } else setScenario(DEFAULT_PRODUCTION_SCENARIO); } catch { setScenario(DEFAULT_PRODUCTION_SCENARIO); }
  }, [project]);
  let result: ReturnType<typeof productionComparison> | null = null;
  try { result = productionComparison(scenario); } catch {}
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const field = (f: typeof FIELDS[number]) => <label key={f.key} className="text-sm">{f.title}<input className="input mt-1" type="number" min={f.min} step={f.step} value={scenario[f.key]} onChange={(e) => setScenario((s) => ({ ...s, [f.key]: Number(e.target.value) }))} /></label>;
  return <section className="my-10 rounded-md border border-border-soft p-5 sm:p-7" aria-labelledby="production-calculator">
    <p className="label !text-accent">Put the assumptions on the table</p><h2 id="production-calculator" className="mt-2 text-2xl">What does an accepted asset cost?</h2><p className="mt-3 text-sm leading-relaxed text-muted">Compare a suite workflow with an API workflow, including the attempts that do not make the cut. Defaults are illustrative planning inputs, not vendor quotes or measured savings.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{FIELDS.slice(0, 4).map(field)}</div><details className="mt-5 rounded border border-border-soft p-4" open><summary className="cursor-pointer font-semibold">Seats, generation and maintenance assumptions</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{FIELDS.slice(4).map(field)}</div></details>
    {result ? <div className="mt-6 rounded-md bg-[#241922] p-6 text-[#faf6ef]" aria-live="polite"><p className="label-sm !text-[#d9bcca]">Monthly scenario · {result.renders.toFixed(1)} attempts</p><div className="my-5 grid gap-6 sm:grid-cols-2"><div><p>Suite workflow</p><p className="mt-1 text-3xl">{money(result.suitePerAsset)}<span className="ml-2 text-xs">/ accepted asset</span></p><p className="mt-2 text-sm text-[#d7cbd2]">{money(result.suite)} per month</p><div className="mt-3 h-2 bg-white/10"><div className="h-2 bg-[#c7a1b8]" style={{ width: `${Math.max(1, result.suite / Math.max(result.suite, result.api, 1) * 100)}%` }} /></div></div><div><p>API workflow</p><p className="mt-1 text-3xl">{money(result.apiPerAsset)}<span className="ml-2 text-xs">/ accepted asset</span></p><p className="mt-2 text-sm text-[#d7cbd2]">{money(result.api)} per month</p><div className="mt-3 h-2 bg-white/10"><div className="h-2 bg-[#a3c5b7]" style={{ width: `${Math.max(1, result.api / Math.max(result.suite, result.api, 1) * 100)}%` }} /></div></div></div><p className="text-sm">Under these assumptions, the {result.cheaper === "suite" ? "suite" : "API"} workflow costs less. Review labour alone accounts for {money(result.review)} in either workflow.</p>{result.breakEven && <p className="mt-3 text-sm text-[#d7cbd2]">API cost crosses below suite cost at approximately {result.breakEven} accepted assets per month, if these per-attempt assumptions remain unchanged.</p>}</div> : <p role="alert" className="mt-5 text-sm text-danger">Enter valid non-negative inputs, with at least one accepted asset, attempt and amortization month.</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => { setScenario({ ...scenario, accepted: 1, apiRender: Number(estimateCost("seedance-2.5-ref", { seconds: 15, aspect: "16:9", resolution: "480p", inputVideoSeconds: 15, hasVideoInputs: true }).toFixed(3)) }); setMessage("VELUNE planning input applied: one accepted 15s film with a 15s guide at 480p. Attempts, suite costs and labour remain your assumptions; this is not the final film's invoice."); }}>Use VELUNE motion estimate</button><button className="btn-secondary" disabled={!result || !project} onClick={() => void saveDraft("productionCost", scenario).then(() => setMessage("Assumptions saved to this project.")).catch((e) => setMessage(e.message))}>Save assumptions</button><button className="btn-primary" disabled={!result} onClick={() => { if (!result) return; const memo = `# Production decision · ${project?.name ?? "Scenario"}\n\nPrepared ${new Date().toISOString()}\n\nIllustrative planning comparison, not a quote. All amounts USD.\n\n${FIELDS.map((f) => `- ${f.title}: ${scenario[f.key]}`).join("\n")}\n\n## Result\nSuite: ${money(result.suite)} / month; ${money(result.suitePerAsset)} / accepted asset.\nAPI: ${money(result.api)} / month; ${money(result.apiPerAsset)} / accepted asset.\nReview labour: ${money(result.review)} in either workflow.\nLower modeled cost: ${result.cheaper}.\n\n## Decision checks\nCompare accepted quality, turnaround, rights and data requirements, integration work and switching effort before choosing. Review time applies to every attempt. Taxes, negotiated discounts, included credit allowances, external finishing and storage are not automatically modeled; adjust your inputs.\n`; downloadStudioFile("production-decision.md", memo, "text/markdown"); }}>Download decision memo</button></div>
    {message && <p role="status" className="mt-4 text-sm text-accent">{message}</p>}<p className="mt-4 text-xs text-muted">Both scenarios use the same review effort. Enter incremental suite credit cost after included allowances. Taxes, negotiated discounts, storage and external finishing are not automatically included.</p>
  </section>;
}
