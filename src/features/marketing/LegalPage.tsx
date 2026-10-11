import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { legalStatus, privacySections, termsSections } from "./legalContent";
import "./legal.css";
export function LegalPage({ kind }: { kind: "Privacy" | "Terms" }) {
  const privacy = kind === "Privacy";
  const sections = privacy ? privacySections : termsSections;
  const jump = (id: string) => {
    const node = document.getElementById(`legal-${id}`);
    node?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    node?.focus({ preventScroll: true });
  };
  return (
    <div className="legal-page m-container">
      <header className="legal-heading">
        <div>
          <span className="legal-eyebrow">CLEAR ABOUT THE DETAILS</span>
          <h1>{privacy ? "Privacy notice" : "Terms of service"}</h1>
          <p>
            {privacy
              ? "Understand what information the app handles, what’s public, and the choices available to you."
              : "Understand the service, your responsibilities, and how subscriptions and access work."}
          </p>
          <span className="legal-version">
            Last reviewed {legalStatus.updated} ·{" "}
            {legalStatus.final ? "Final" : "Draft for review"}
          </span>
        </div>
      </header>
      <div className="legal-highlights">
        {(privacy
          ? [
              [
                "Public by choice",
                "Published cards and uploaded brand/profile images can be publicly accessible.",
              ],
              [
                "Activity, clearly explained",
                "Browser-based visits and clicks are measured; completed reviews are not.",
              ],
              [
                "Your questions matter",
                "Use Contact for privacy requests and account-data assistance.",
              ],
            ]
          : [
              [
                "Know your plan",
                "Feature access and saved-item limits follow verified subscription status.",
              ],
              [
                "Know your billing",
                "Paid plans charge at checkout and renew monthly until cancelled.",
              ],
              [
                "Keep feedback honest",
                "Invite every experience and respect the rules of external platforms.",
              ],
            ]
        ).map(([title, text]) => (
          <div key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="legal-reading">
        <aside className="legal-contents">
          <span className="legal-eyebrow">ON THIS PAGE</span>
          <nav aria-label={`${kind} contents`}>
            {sections.map((section, index) => (
              <button key={section.id} onClick={() => jump(section.id)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </button>
            ))}
          </nav>
          <Link to={privacy ? "/terms" : "/privacy"}>
            {privacy ? "Read the terms" : "Read the privacy notice"}
            <ArrowRight size={15} />
          </Link>
        </aside>
        <article className="legal-document">
          {sections.map((section, index) => (
            <section key={section.id} id={`legal-${section.id}`} tabIndex={-1}>
              <span className="legal-section-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <div className="legal-provider-links">
            <h3>Provider information</h3>
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Supabase privacy information
            </a>
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Stripe privacy information
            </a>
            <a
              href="https://developers.google.com/fonts/faq/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google Fonts privacy information
            </a>
          </div>
        </article>
      </div>
      <section className="legal-contact">
        <div>
          <span className="legal-eyebrow">LET’S KEEP IT CLEAR</span>
          <h2>
            Have a question about {privacy ? "your information" : "the service"}
            ?
          </h2>
          <p>
            Send a message through our private contact form. Please leave out
            passwords and full payment details.
          </p>
        </div>
        <Link className="m-button m-primary" to="/contact">
          Contact Revbaze
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
