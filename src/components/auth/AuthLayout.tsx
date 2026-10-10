import { BrandLogo } from "../shared/BrandLogo";
import type { ReactNode } from "react";
import { Link2, Check } from "lucide-react";
import { useLocation } from "react-router-dom";
export function AuthLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const useBlueLogo = ["/login", "/signup", "/check-email", "/reset-password", "/forgot-password", "/auth/callback", "/accept-invitation"].includes(pathname);
  return (
    <div
      className={`app auth-shell${useBlueLogo ? " auth-primary-branding" : ""}`}
    >
      <aside className="auth-story">
        <a href="/" className="auth-brand">
          <BrandLogo variant={useBlueLogo ? "blue" : "adaptive"} />
        </a>
        <div className="auth-story-copy">
          <span className="auth-pill">
            <Link2 size={14} /> ONE LINK. EVERY REVIEW PLATFORM.
          </span>
          <h1>
            Good feedback starts
            <br />
            with a little link.
          </h1>
          <p>
            Give your customers a simple way to share their experience. Keep
            every review destination in one place.
          </p>
          <ul>
            <li>
              <Check size={17} /> Create a review card for your business
            </li>
            <li>
              <Check size={17} /> Add your favorite review platforms
            </li>
            <li>
              <Check size={17} /> Share your link or a custom QR code
            </li>
          </ul>
        </div>
        <small>Built for the businesses people love.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <BrandLogo variant={useBlueLogo ? "blue" : "adaptive"} />
        </div>
        <div className="auth-content">{children}</div>
        <footer>One link. Every review platform.</footer>
      </main>
    </div>
  );
}
