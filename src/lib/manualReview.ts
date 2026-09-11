export type ManualCheck = { status: "pending" | "pass" | "flag" | "not_applicable"; evidence: string };
export type ManualReview = { assetId: string; assetName: string; assetVersion: string; sourceIdentity: string; reviewer: string; decision: "draft" | "changes_required" | "approved"; decidedAt?: string; checks: Record<string, ManualCheck>; notes: string; checklistVersion: string };
export function readManualReview(value: unknown): ManualReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as ManualReview;
  if (![r.assetId, r.assetName, r.assetVersion, r.sourceIdentity, r.reviewer, r.notes, r.checklistVersion].every((v) => typeof v === "string") || !["draft", "changes_required", "approved"].includes(r.decision) || !r.checks || typeof r.checks !== "object" || Array.isArray(r.checks) || (r.decidedAt !== undefined && (typeof r.decidedAt !== "string" || !Number.isFinite(Date.parse(r.decidedAt))))) return null;
  if (Object.values(r.checks).some((c) => !c || !["pending", "pass", "flag", "not_applicable"].includes(c.status) || typeof c.evidence !== "string")) return null;
  return r;
}
export function manualReviewProblems(review: ManualReview, keys: string[]) {
  const issues: string[] = [];
  if (!review.assetName.trim() || !review.assetVersion.trim()) issues.push("Identify the asset and its version.");
  if (review.decision !== "draft" && !review.reviewer.trim()) issues.push("Name the accountable human reviewer.");
  if (review.decision === "approved") {
    if (keys.some((key) => !review.checks[key] || review.checks[key].status === "pending")) issues.push("Resolve every applicable check before recording approval.");
    if (keys.some((key) => review.checks[key]?.status === "flag")) issues.push("Flagged checks need resolution; record changes required instead.");
    if (keys.some((key) => !review.checks[key]?.evidence.trim())) issues.push("Add evidence for confirmations and reasons for checks marked not applicable.");
  }
  return issues;
}
export function readableManualReview(review: ManualReview, rows: { key: string; title: string }[]) {
  return `# Human review · ${review.assetName}\n\nAsset: ${review.assetId}\nVersion: ${review.assetVersion}\nSource identity: ${review.sourceIdentity}\nChecklist: ${review.checklistVersion}\nReviewer: ${review.reviewer || "Not recorded"}\nDecision: ${review.decision}\nRecorded: ${review.decidedAt || "Draft"}\n\nThis is a human-declared review record, not AI verification or legal certification. It applies only to the identified asset version.\n\n${rows.map((row) => `## ${row.title}\nStatus: ${review.checks[row.key]?.status ?? "pending"}\nEvidence / applicability: ${review.checks[row.key]?.evidence || "Not recorded"}\n`).join("\n")}\n## Reviewer notes\n${review.notes || "None"}\n`;
}
