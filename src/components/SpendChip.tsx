import { Why } from "@/components/Why";

/**
 * The running cost estimate, in the one place all three tools read from.
 *
 * It used to read "Session spend" in Ad Lab, Campaign Studio and Packshots,
 * which was wrong in two ways at once: the figure is keyed on
 * `studio-session-spend` in localStorage, so it outlives the tab it was
 * started in, and it is an estimate this page computes rather than anything a
 * provider has billed. Neither is a small distinction on a number denominated
 * in dollars.
 *
 * One component rather than three copies, so the wording cannot drift back
 * apart — and the scope explanation rides along with it.
 */
export function SpendChip({ amount }: { amount: number }) {
  return (
    <span className="chip">
      Est. spend on this browser: ${amount.toFixed(2)}
      <Why title="What this number is">
        A running estimate of what live generations would have cost, added up in
        this browser&rsquo;s local storage. It is not a bill: it survives closing
        the tab, it counts this browser rather than your account, and the real
        charge is whatever the providers invoice. The budget that actually stops
        a run is enforced on the server, separately from this.
      </Why>
    </span>
  );
}
