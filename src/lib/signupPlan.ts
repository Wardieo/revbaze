import type { PlanId } from "./plans";
const key = "revbaze-signup-plan-choice";
const validityMs = 24 * 60 * 60 * 1000;
export function rememberSignupPlan(plan: PlanId): boolean {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ plan, selectedAt: Date.now(), source: "pricing" }),
    );
    return true;
  } catch {
    return false;
  }
}
export function hasSignupPlanChoice(plan: string | null): plan is PlanId {
  if (!["free", "growth", "pro"].includes(plan || "")) return false;
  try {
    const choice = JSON.parse(sessionStorage.getItem(key) || "null");
    const age = Date.now() - choice?.selectedAt;
    return (
      choice?.source === "pricing" &&
      choice.plan === plan &&
      Number.isFinite(age) &&
      age >= 0 &&
      age < validityMs
    );
  } catch {
    return false;
  }
}
export function clearSignupPlan() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage can be unavailable. */
  }
}
