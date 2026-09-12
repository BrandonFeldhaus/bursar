import { clearBudget } from "./storage";

/** Wipe every stored key and reload the Overview, which then shows the empty state. */
export function eraseAllData() {
  clearBudget();
  window.location.assign("/");
}
