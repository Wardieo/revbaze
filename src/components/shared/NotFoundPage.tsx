import { useEffect, type CSSProperties } from "react";
import { BrandLogo } from "./BrandLogo";

export function NotFoundPage() {
  useEffect(() => { document.title = "Page not found – Revbaze"; }, []);
  return (
    <main className="not-found-page">
      <a className="not-found-brand" href="/" aria-label="Revbaze home"><BrandLogo /></a>
      <section className="not-found-content">
        <div className="wp-404" role="img" aria-label="404 error animation: a hyperspace tunnel of rings rushing outward past a 404">
          <div className="wp-stage">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="wp-ring" style={{ "--i": i } as CSSProperties} />
            ))}
            <span className="wp-num">404</span>
          </div>
        </div>
        <span className="not-found-code">404 · LINK NOT FOUND</span>
        <h1>A little lost?</h1>
        <p>This link doesn’t lead anywhere. Let’s get you back to a familiar place.</p>
        <div className="not-found-actions">
          <button className="button primary" onClick={() => {
            if (window.history.length > 1) window.history.back();
            else window.location.assign("/");
          }}>Go back</button>
        </div>
      </section>
    </main>
  );
}
