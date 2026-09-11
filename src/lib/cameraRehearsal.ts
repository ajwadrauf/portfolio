export type RehearsalMove = "orbit" | "push" | "crane";
export function rehearsalPose(move: RehearsalMove, progress: number) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const eased = t * t * (3 - 2 * t);
  if (move === "orbit") {
    const angle = (-35 + 90 * t) * Math.PI / 180;
    return { position: [Math.sin(angle) * 5.5, 2.4, Math.cos(angle) * 5.5] as [number, number, number], target: [0, 0.9, 0] as [number, number, number] };
  }
  if (move === "push") return { position: [0.8, 1.9, 7 - 3 * eased] as [number, number, number], target: [0, 0.9, 0] as [number, number, number] };
  return { position: [3.8, 1.7 + 4.5 * eased, 4.8] as [number, number, number], target: [0, 0.7, 0] as [number, number, number] };
}
export function rehearsalDescription(move: RehearsalMove) {
  return move === "orbit" ? "A 90-degree orbit at a 5.5 m radius, fixed focal length, target held on the product." :
    move === "push" ? "An eased 3 m push toward the product, fixed focal length and target." :
      "An eased crane rise from 1.7 m to 6.2 m, camera aimed at the product throughout.";
}
