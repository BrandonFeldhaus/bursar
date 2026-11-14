import { clearBudget } from "./storage";

/**
 * Wipe every stored key and reload the Overview, which then shows the empty state.
 * The Overview lives at the base path (`/bursar/` on GitHub Pages), not the domain root —
 * a bare "/" would leave the app for whatever else is hosted on the domain.
 */
export function eraseAllData() {
  clearBudget();
  window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
}
