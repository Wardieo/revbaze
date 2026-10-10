import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  LayoutDashboard,
  Link2,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import "./feature-details.css";
const answers = [
  [
    "Can I make the review card match my business?",
    "Yes. Add your business logo and welcome message, choose a layout, and customize accent color, card color, borders, buttons, and the background behind the card. Page backgrounds support plain color, gradients, dots, abstract rings, and waves.",
  ],
  [
    "Where do customers leave their reviews?",
    "Your card sends customers to the external review platforms you choose. Revbaze tracks visits and outbound clicks; a click does not confirm a completed review.",
  ],
  [
    "Which plans include detailed analytics?",
    "Growth and Pro include detailed analytics, filters, comparisons, and CSV exports. Growth retains 12 months of analytics and Pro retains 24 months. Free includes basic daily performance on Overview.",
  ],
  [
    "Can I customize my QR code?",
    "Basic QR generation is available on Free. Growth and Pro include QR customization. Test your downloaded QR code on a phone before printing or distributing it.",
  ],
  [
    "Can I manage more than one business?",
    "Free supports one business and one review card. Growth supports two businesses and five review cards. Pro supports unlimited businesses and review cards, with separate workspaces for each business.",
  ],
  [
    "Can my team help manage a business?",
    "Growth includes five invited members and Pro includes 20, shared across the owner’s businesses. Only owners invite or manage members. Admins can edit business settings, cards, and platforms; Editors can edit cards and platforms; Viewers have read-only dashboard access. Access can be limited to one business or all currently owned businesses.",
  ],
  [
    "Do integrations deliver events automatically?",
    "Integration connection setup is available for paid accounts. Saving a connection does not enable automatic event delivery. Only rely on workflows that are explicitly supported and enabled.",
  ],
];
export function FeatureDetails() {
  return (
    <div className="feature-details">
      <section className="m-container fd-library" aria-labelledby="fd-heading">
        <header className="fd-heading">
          <div>
            <span className="fd-eyebrow">THOUGHTFUL BY DESIGN</span>
            <h2 id="fd-heading">
              Small details.
              <br />A better experience.
            </h2>
          </div>
          <p>
            A familiar invitation for your customers.
            <br />A clear workspace for you.
          </p>
        </header>
        <div className="fd-grid">
          <article className="fd-card fd-card-brand">
            <div className="fd-card-copy">
              <span className="fd-icon">
                <LayoutDashboard size={21} />
              </span>
              <h3>Review cards that feel like you.</h3>
              <p>
                Your logo, your colors, and a thoughtful invitation. Bring your
                review destinations into one branded page.
              </p>
              <Link to="/resources/review-links">
                Make your first card <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="fd-brand-preview" aria-hidden="true">
              <div className="fd-brand-top">
                <span>N.</span>
                <strong>Northside Studio</strong>
              </div>
              <h4>How was your visit?</h4>
              <p>Your experience. Your choice.</p>
              <div>
                <PlatformIcon id="google" />
                <span>Google Reviews</span>
                <ArrowRight size={15} />
              </div>
              <div>
                <PlatformIcon id="facebook" />
                <span>Facebook</span>
                <ArrowRight size={15} />
              </div>
              <small>Illustrative business</small>
            </div>
          </article>
          <article className="fd-card fd-card-qr">
            <span className="fd-icon">
              <QrCode size={21} />
            </span>
            <h3>Your invitation, offline.</h3>
            <p>
              Download a QR code for the places customers already notice. Keep
              the next step simple and easy to scan.
            </p>
            <div className="fd-qr-styles" aria-hidden="true">
              <span>
                <QrCode size={43} strokeWidth={1.5} />
                Classic
              </span>
              <span>
                <QrCode size={43} strokeWidth={2} />
                Rounded
              </span>
              <span>
                <QrCode size={43} strokeWidth={2.5} />
                Dots
              </span>
            </div>
            <small className="fd-caption">
              Style illustration · customization on paid plans
            </small>
            <Link to="/resources/qr-codes">
              Explore QR sharing <ArrowUpRight size={16} />
            </Link>
          </article>
          <article className="fd-card fd-card-platforms">
            <span className="fd-icon">
              <Link2 size={21} />
            </span>
            <h3>
              All your destinations.
              <br />
              One little link.
            </h3>
            <p>
              Organize your official review links and give customers clear
              choices.
            </p>
            <div className="fd-platforms" aria-hidden="true">
              {["google", "facebook", "trustpilot", "yelp"].map((id) => (
                <span key={id}>
                  <PlatformIcon id={id} />
                </span>
              ))}
            </div>
            <Link to="/resources/honest-feedback">
              Invite every experience <ArrowUpRight size={16} />
            </Link>
          </article>
          <article className="fd-card fd-card-analytics">
            <div className="fd-card-copy">
              <span className="fd-icon">
                <BarChart3 size={21} />
              </span>
              <h3>A clearer view of your activity.</h3>
              <p>
                Understand page views, outbound clicks, and sharing sources.
                Compare performance and find your next useful question.
              </p>
              <Link to="/resources/understanding-analytics">
                Understand your metrics <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="fd-chart-preview">
              <div>
                <strong>Invitation activity</strong>
                <span>Illustrative graph</span>
              </div>
              <svg
                viewBox="0 0 320 140"
                role="img"
                aria-label="Illustrative page views and outbound click trends"
              >
                {[30, 70, 110].map((y) => (
                  <path
                    key={y}
                    d={`M10 ${y} H310`}
                    stroke="#ffffff20"
                    strokeDasharray="3 5"
                  />
                ))}
                <path
                  d="M10 110 C45 110 40 85 75 90 S115 110 145 65 S200 90 225 40 S265 55 310 15"
                  fill="none"
                  stroke="#c9d8e9"
                  strokeWidth="3"
                />
                <path
                  d="M10 125 C55 125 65 110 100 115 S170 90 205 100 S270 65 310 75"
                  fill="none"
                  stroke="#7fbba9"
                  strokeWidth="2.5"
                />
              </svg>
              <span>Detailed analytics on Growth & Pro</span>
            </div>
          </article>
          <article className="fd-card fd-card-connections">
            <span className="fd-icon">
              <Link2 size={21} />
            </span>
            <h3>A place for your connections.</h3>
            <p>
              Save integration connection details in your workspace. Connection
              setup is available on paid plans; automatic delivery is not
              enabled.
            </p>
            <div className="fd-connection-list">
              {["zapier", "make", "n8n"].map((id) => (
                <span key={id}>
                  <PlatformIcon id={id} />
                  <span>
                    {id === "zapier"
                      ? "Zapier"
                      : id === "make"
                        ? "Make"
                        : "n8n"}
                  </span>
                  <small>Setup</small>
                </span>
              ))}
            </div>
          </article>
          <article className="fd-card fd-card-workspaces">
            <span className="fd-icon">
              <ShieldCheck size={21} />
            </span>
            <h3>Room to stay organized.</h3>
            <p>
              Keep your business workspaces, cards, and review destinations
              together. Switch between businesses as your plan allows.
            </p>
            <div className="fd-workspace-preview" aria-hidden="true">
              <span>
                <span>N.</span>
                <strong>Northside Studio</strong>
                <Check size={17} />
              </span>
              <span>
                <span>H.</span>
                <strong>Haven House</strong>
                <ChevronDown size={17} />
              </span>
              <small>Illustrative workspaces</small>
            </div>
            <Link to="/pricing">
              Find the right fit <ArrowUpRight size={16} />
            </Link>
          </article>
        </div>
      </section>
      <section className="m-container fd-faq" aria-labelledby="fd-faq-heading">
        <div>
          <span className="fd-eyebrow">A FEW GOOD QUESTIONS</span>
          <h2 id="fd-faq-heading">
            A little clarity.
            <br />
            Before you begin.
          </h2>
          <p>
            Understand what the toolkit does and choose the features that fit
            your business.
          </p>
          <Link className="fd-text-link" to="/contact">
            Ask us a question <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="fd-answers">
          {answers.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={19} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="m-container fd-final">
        <div>
          <span className="fd-eyebrow">
            ONE INVITATION. MANY POSSIBILITIES.
          </span>
          <h2>
            Make your next invitation
            <br />a little more meaningful.
          </h2>
          <p>Your business. Your brand. One beautiful review link.</p>
          <div className="fd-final-actions">
            <a className="m-button m-primary" href="/pricing">
              Get started with Revbaze <ArrowRight size={18} />
            </a>
            <Link className="fd-text-link" to="/pricing">
              Compare plans <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <div className="fd-final-art" aria-hidden="true">
          <span>
            <Link2 size={44} />
          </span>
          <div />
          <div />
        </div>
      </section>
    </div>
  );
}
