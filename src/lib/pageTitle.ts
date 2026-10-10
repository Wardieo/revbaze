export const homeTitle = "Revbaze – One link. Every review platform.";
const pageNames: Record<string, string> = {
  "/login": "Login", "/signup": "Sign up", "/check-email": "Confirm your email",
  "/forgot-password": "Forgot password", "/reset-password": "Reset password",
  "/auth/callback": "Account verification", "/product": "Product", "/features": "Features",
  "/solutions": "Solutions", "/pricing": "Pricing", "/about": "About", "/contact": "Contact",
  "/resources": "Resources", "/privacy": "Privacy", "/terms": "Terms",
  "/accept-invitation": "Join your workspace", "/onboarding": "Onboarding", "/start-plan": "Checkout", "/checkout": "Checkout",
  "/upgrade": "Choose a plan", "/settings": "Settings", "/profile": "Profile",
};
export function pageTitle(path: string, label?: string) {
  if (path === "/") return homeTitle;
  return `${label || pageNames[path] || "Revbaze"} – Revbaze`.replace("Revbaze – Revbaze", "Revbaze");
}
