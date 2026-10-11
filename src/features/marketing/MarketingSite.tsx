import { pageTitle } from "../../lib/pageTitle";
import { guides } from "./resourceGuides";
import { rememberSignupPlan } from "../../lib/signupPlan";
import type { PlanId } from "../../lib/plans";
import { LegalPage } from "./LegalPage";
import { FeatureDetails } from "./FeatureDetails";
import { SolutionsPage } from "./SolutionsPage";
import { ResourcesPage, GuidePage } from "./ResourcesPages";
import { ContactPage } from "./ContactPage";
import { HowItWorks } from "./HowItWorks";
import { BrandLogo } from "../../components/shared/BrandLogo";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Heart,
  LayoutDashboard,
  Link2,
  Menu,
  MessageSquare,
  Plus,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { CardPreview } from "../review-cards/CardPreview";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import { platforms, getPlatform } from "../../lib/platforms";
import { planCatalog, planFeatures } from "../../lib/plans";
import { overviewActivity } from "../overview/mockActivity";
import type { ReviewCard, ReviewLink } from "../../types/workspace";
import type { ReactNode } from "react";
import "./marketing.css";
import "./about.css";
const QRPreview = lazy(() =>
  import("../qr-codes/QRPreview").then((m) => ({ default: m.QRPreview })),
);
const currentYear = new Date().getFullYear();
const navigation = [
  ["Product", "/product"],
  ["Features", "/features"],
  ["Solutions", "/solutions"],
  ["Pricing", "/pricing"],
  ["Resources", "/resources"],
];
const features = [
  {
    id: "cards",
    name: "Review cards",
    icon: Link2,
    text: "A beautiful home for your review links. Choose a layout, make it yours, and publish one invitation.",
  },
  {
    id: "qr",
    name: "QR codes",
    icon: QrCode,
    text: "Take your invitation off the screen. Customize colors, styles, and your logo, then download PNG or SVG.",
  },
  {
    id: "platforms",
    name: "Review platforms",
    icon: Link2,
    text: "Keep your review destinations in one place. Add platform links, choose which appear on each card, and make it easy for customers to find you.",
  },
  {
    id: "analytics",
    name: "Analytics",
    icon: BarChart3,
    text: "Explore page views, outbound clicks, and platform distribution in an interactive sample dashboard.",
    preview: true,
  },
  {
    id: "integrations",
    name: "Integrations",
    icon: Plus,
    text: "Explore how your review workflow could connect with your team’s everyday tools.",
    preview: true,
  },
];
const descriptions: Record<string, string> = {
  "/": "One beautiful link for honest customer feedback. Create branded review cards, customize QR codes, and explore your performance with Revbaze.",
  "/product":
    "Explore Revbaze review cards, QR codes, and a preview of the review-link workspace.",
  "/features":
    "Discover branded review cards, custom QR codes, and previews of Revbaze analytics, review platforms, and integrations.",
  "/solutions":
    "Review invitations for hospitality, local services, retail, and other customer-facing businesses.",
  "/pricing":
    "Compare Revbaze Free, Growth at $10/month, and Pro at $29/month. Clear account limits and monthly pricing; USD payments through Stripe.",
  "/about":
    "Learn why Revbaze is building a simpler way to invite honest customer feedback.",
  "/contact":
    "Prepare a message for the Revbaze team. Contact delivery is not connected yet.",
  "/privacy":
    "How Revbaze handles account information, public review cards, browser analytics, billing, and privacy requests.",
  "/terms":
    "Revbaze service terms covering accounts, subscriptions, cancellation, and responsible use. Draft for review.",
  "/resources":
    "Practical guides to review links, QR codes, and welcoming customer feedback.",
};
function Brand() {
  return (
    <Link className="m-brand" to="/" aria-label="Revbaze home">
      <BrandLogo />
    </Link>
  );
}
function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    element.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          element.dataset.reveal = "visible";
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`m-reveal ${className}`}>
      {children}
    </div>
  );
}
export default function MarketingSite() {
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const path = location.pathname.replace(/\/$/, "") || "/";
  useEffect(() => {
    const guide = path.startsWith("/resources/") ? guides.find(item => item.slug === path.split("/")[2]) : undefined;
    document.title = pageTitle(path, guide?.title);
    const description =
      descriptions[path] ||
      "Helpful resources and product information from Revbaze.";
    for (const [selector, attribute, value] of [
      ['meta[name="description"]', "name", "description"],
      ['meta[property="og:description"]', "property", "og:description"],
      ['meta[name="twitter:description"]', "name", "twitter:description"],
    ]) {
      let node = document.querySelector<HTMLMetaElement>(selector);
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(attribute, value);
        document.head.append(node);
      }
      node.content = description;
    }
    for (const property of ["og:title", "og:url"]) {
      let meta = document.querySelector<HTMLMetaElement>(
        `meta[property="${property}"]`,
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.append(meta);
      }
      meta.content =
        property === "og:title"
          ? document.title
          : window.location.origin + path;
    }
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = window.location.origin + path;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);
  return (
    <div
      className="app marketing-site"
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          'a[href^="/#/"]',
        );
        if (
          !anchor ||
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        // The marketing router and authenticated hash router are separate shells.
        // A hash-only navigation from the homepage needs a fresh app bootstrap.
        if (window.location.pathname === "/" && !window.location.search) {
          event.preventDefault();
          window.location.assign(anchor.href);
          window.location.reload();
        }
      }}
    >
      <a className="m-skip" href="#marketing-content">
        Skip to content
      </a>
      <header className="m-nav">
        <div className="m-nav-inner">
          <Brand />
          <nav
            className={`m-nav-links ${menu ? "open" : ""}`}
            aria-label="Main navigation"
          >
            {navigation.map(([name, url]) => (
              <Link
                key={url}
                to={url}
                aria-current={path === url ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                {name}
              </Link>
            ))}
          </nav>
          <div className="m-nav-actions">
            <a className="m-login" href="/#/login">
              Log in
            </a>
            <button
              className="m-menu"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="marketing-content" className="m-main" tabIndex={-1} key={path}>
        {path === "/" ? (
          <Home />
        ) : path === "/product" ? (
          <ProductPage />
        ) : path === "/features" ? (
          <FeaturesPage />
        ) : path === "/solutions" ? (
          <SolutionsPage industries={industries} />
        ) : path === "/pricing" ? (
          <PricingPage />
        ) : path === "/about" ? (
          <AboutPage />
        ) : path === "/contact" ? (
          <ContactPage />
        ) : path === "/resources" ? (
          <ResourcesPage />
        ) : path.startsWith("/resources/") ? (
          <GuidePage slug={path.split("/")[2]} />
        ) : (
          <LegalPage kind={path === "/privacy" ? "Privacy" : "Terms"} />
        )}
      </main>
      <Footer />
    </div>
  );
}
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="m-eyebrow">
      <span />
      {children}
    </span>
  );
}
function Actions() {
  return (
    <div className="m-actions">
      <a className="m-button m-primary" href="/pricing">
        Create your review link
        <ArrowRight size={17} />
      </a>
      <Link className="m-button m-secondary" to="/product">
        Explore the product
        <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
function PageIntro({
  tag,
  title,
  text,
}: {
  tag: string;
  title: string;
  text: string;
}) {
  return (
    <section className="m-page-intro m-container">
      <Eyebrow>{tag}</Eyebrow>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
function Home() {
  return (
    <>
      <section className="m-hero m-container">
        <div className="m-hero-grid">
          <Reveal className="m-hero-copy">
            <Eyebrow>One link. Every review platform.</Eyebrow>
            <h1>
              Turn Customer
              <br />
              Feedback Into
              <br />
              <span>Business Growth.</span>
            </h1>
            <p>
              A thoughtful invitation goes a long way. Bring your review links
              together in one beautiful card, ready to share wherever your
              customers are.
            </p>
            <Actions />
            <div className="m-hero-notes">
              <span>
                <Check size={14} />
                Your brand, your invitation
              </span>
              <span>
                <Check size={14} />
                Every experience welcome
              </span>
            </div>
          </Reveal>
          <Reveal className="m-hero-visual m-photo-hero">
            <div className="m-photo-orbit" aria-hidden="true" />
            <div className="m-photo-dots" aria-hidden="true" />
            <figure className="m-hero-photo m-hero-photo-main">
              <img src="/images/hero/feedback-counter.jpeg" alt="A feedback QR code displayed on a café counter" fetchPriority="high" />
              <figcaption>At your counter. Ready for feedback.</figcaption>
            </figure>
            <figure className="m-hero-photo m-hero-photo-customer">
              <img src="/images/hero/customer-scan.jpeg" alt="A customer scanning a countertop QR code with her phone" />
            </figure>
            <figure className="m-hero-photo m-hero-photo-shop">
              <img src="/images/hero/shop-scan.jpeg" alt="A shopper using a QR code at a small business" />
            </figure>
            <figure className="m-hero-photo m-hero-photo-reception">
              <img src="/images/hero/reception-scan.jpeg" alt="A guest scanning a QR code at reception" />
            </figure>
            <div className="m-photo-invitation"><QrCode size={20} /><div><strong>Scan. Choose. Share.</strong><span>A little invitation, wherever you meet.</span></div></div>
            <span className="m-photo-caption">Inspiration for displaying your review QR code</span>
          </Reveal>
        </div>
        <div className="m-platform-strip">
          <span>One home for your review links</span>
          {["google", "facebook", "trustpilot", "yelp", "g2", "capterra"].map(
            (id) => (
              <span key={id}>
                <PlatformIcon id={id} />
                {id === "google"
                  ? "Google"
                  : id === "g2"
                    ? "G2"
                    : id.charAt(0).toUpperCase() + id.slice(1)}
              </span>
            ),
          )}
        </div>
        <p className="m-platform-disclaimer">
          Platform names identify supported review-link destinations, not
          partnerships.
        </p>
      </section>
      <Showcase />
      <HowItWorks />
      <FeaturesSection />
      <SolutionsSection />
      <PricingSection />
      <FAQ />
      <FinalCTA />
    </>
  );
}
const sampleLinks: ReviewLink[] = ["google", "trustpilot", "facebook"].map(
  (platform_id, index) => ({
    id: `sample-${index}`,
    business_id: "sample",
    platform_id,
    display_name: ["Google Reviews", "Trustpilot", "Facebook"][index],
    destination_url: "https://example.com",
    is_active: true,
    created_at: "",
    updated_at: "",
  }),
);
function ProductCard({ compact = false }: { compact?: boolean }) {
  const [template, setTemplate] = useState<"classic" | "grid">("classic");
  const [blue, setBlue] = useState(true);
  const card: ReviewCard = {
    id: "sample",
    business_id: "sample",
    name: "The everyday invitation",
    slug: "studio-north",
    headline: "A little feedback goes a long way.",
    description:
      "Choose your favorite platform and share your experience with us.",
    appearance_settings: {
      business_name: "Studio North",
      logo_url: "",
      accent: blue ? "#042751" : "#64748b",
      background: "#ffffff",
      button_style: "soft",
      radius: "rounded",
      template,
    },
    is_active: true,
    created_at: "",
    updated_at: "",
    links: sampleLinks.map((l, i) => ({
      business_review_link_id: l.id,
      display_order: i,
      is_enabled: true,
    })),
  };
  return (
    <div className={`m-product-card ${compact ? "compact" : ""}`}>
      <div className="m-card-toolbar">
        <span>
          <span className="m-live-dot" />
          REVIEW CARD PREVIEW
        </span>
        <button
          aria-label="Toggle card accent"
          onClick={() => setBlue(!blue)}
          className={blue ? "blue" : "gray"}
        />
      </div>
      <CardPreview card={card} links={sampleLinks} />
      {!compact && (
        <div className="m-preview-controls">
          <button
            aria-pressed={template === "classic"}
            onClick={() => setTemplate("classic")}
          >
            Centered
          </button>
          <button
            aria-pressed={template === "grid"}
            onClick={() => setTemplate("grid")}
          >
            Platform grid
          </button>
        </div>
      )}
    </div>
  );
}
function DashboardPreview() {
  const [days, setDays] = useState(30);
  const data = overviewActivity(days);
  const points = data.chart;
  const max = Math.max(...points.map((p) => p.views));
  const line = (key: "views" | "clicks") =>
    points
      .map(
        (p, i) =>
          `${20 + (i / (points.length - 1)) * 640},${180 - (p[key] / max) * 145}`,
      )
      .join(" ");
  return (
    <div className="m-dashboard">
      <div className="m-dashboard-bar">
        <span className="m-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>revbaze / overview</span>
        <span className="m-sample-chip">Sample activity</span>
      </div>
      <div className="m-dashboard-body">
        <aside className="m-dashboard-sidebar">
          <Brand />
          <span className="m-workspace-demo">
            SN <strong>Studio North</strong>
          </span>
          {[
            "Overview",
            "Review cards",
            "Analytics",
            "Review platforms",
            "QR codes",
          ].map((name) => (
            <span key={name} className={name === "Overview" ? "active" : ""}>
              <LayoutDashboard size={13} />
              {name}
            </span>
          ))}
        </aside>
        <div className="m-dashboard-content">
          <div className="m-dashboard-heading">
            <strong>Performance overview</strong>
            <div>
              {[7, 30, 90].map((n) => (
                <button
                  key={n}
                  aria-pressed={days === n}
                  onClick={() => setDays(n)}
                >
                  {n} days
                </button>
              ))}
            </div>
          </div>
          <div className="m-demo-stats">
            {[
              ["Page views", data.stats.views.toLocaleString()],
              ["Review link clicks", data.stats.clicks.toLocaleString()],
              ["Click-through rate", `${data.stats.ctr.toFixed(1)}%`],
              ["Active review cards", String(data.active)],
            ].map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
                <span className="m-stat-foot">Selected sample period</span>
              </div>
            ))}
          </div>
          <div className="m-demo-chart">
            <div>
              <strong>Views & outbound clicks</strong>
              <span>
                <i />
                Page views <i />
                Clicks
              </span>
            </div>
            <svg
              viewBox="0 0 680 200"
              role="img"
              aria-label={`Sample page views and outbound clicks over ${days} days`}
            >
              {[40, 85, 130, 175].map((y) => (
                <line
                  key={y}
                  x1="20"
                  x2="660"
                  y1={y}
                  y2={y}
                  stroke="#e8edf5"
                  strokeDasharray="3 5"
                />
              ))}
              <polyline
                points={line("views")}
                fill="none"
                stroke="#042751"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <polyline
                points={line("clicks")}
                fill="none"
                stroke="#75bca4"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <circle
                  key={p.date}
                  cx={20 + (i / (points.length - 1)) * 640}
                  cy={180 - (p.views / max) * 145}
                  r="5"
                  fill="transparent"
                  tabIndex={0}
                >
                  <title>
                    {new Date(p.date).toLocaleDateString()}: {p.views} views,{" "}
                    {p.clicks} clicks
                  </title>
                </circle>
              ))}
            </svg>
            <div className="m-chart-dates">
              <span>Start of period</span>
              <span>Today</span>
            </div>
          </div>
          <div className="m-demo-bottom">
            <div>
              <strong>Top review platforms</strong>
              {data.platforms.slice(0, 3).map((p) => (
                <div className="m-mini-platform" key={p.id}>
                  <PlatformIcon id={p.id} small />
                  <span>{p.name}</span>
                  <strong>{p.clicks.toLocaleString()}</strong>
                </div>
              ))}
            </div>
            <div className="m-demo-share">
              <Link2 size={23} />
              <strong>Your review link</strong>
              <span>revbaze.com / r / studio-north</span>
              <span className="m-sample-chip">Illustrative URL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Showcase() {
  return (
    <section className="m-section m-showcase">
      <div className="m-container">
        <Reveal className="m-section-heading">
          <Eyebrow>A calm home for customer feedback</Eyebrow>
          <h2>
            Less scattered.
            <br />
            <span>More connected.</span>
          </h2>
          <p>
            Your cards, destinations, and performance, together in a workspace
            that feels effortless.
          </p>
        </Reveal>
        <Reveal className="m-dashboard-frame">
          <DashboardPreview />
        </Reveal>
        <p className="m-preview-disclaimer">
          Interactive sample activity for illustration. Your workspace analytics
          show recorded visits and outbound clicks from your published review pages.
        </p>
      </div>
    </section>
  );
}
function FeaturesSection() {
  return (
    <section className="m-section m-feature-section">
      <div className="m-container">
        <Reveal className="m-section-heading m-heading-row">
          <div>
            <Eyebrow>Thoughtful by design</Eyebrow>
            <h2>
              Small details.
              <br />A better experience.
            </h2>
          </div>
          <Link className="m-text-link" to="/features">
            Explore all features
            <ArrowRight size={16} />
          </Link>
        </Reveal>
        <div className="m-feature-grid">
          {features.map((f, i) => (
            <Reveal key={f.id} className={`m-feature-tile feature-${f.id}`}>
              <div className="m-feature-icon">
                <f.icon size={23} />
              </div>
              <h3>
                {f.name}
                {f.preview && <span className="m-preview-badge">Preview</span>}
              </h3>
              <p>{f.text}</p>
              {i === 0 ? (
                <div className="m-mini-link">
                  <Link2 size={16} />
                  <span>Your business. Your little link.</span>
                  <ArrowUpRight size={15} />
                </div>
              ) : i === 1 ? (
                <div className="m-qr-designs">
                  <QrCode />
                  <QrCode />
                  <QrCode />
                  <span>Classic · Rounded · Dots</span>
                </div>
              ) : i === 2 ? (
                <div className="m-integrations-mini">
                  <PlatformIcon id="google" />
                  <PlatformIcon id="facebook" />
                  <PlatformIcon id="trustpilot" />
                </div>
              ) : i === 3 ? (
                <div className="m-mini-bars">
                  {[38, 52, 42, 67, 58, 80, 72, 92].map((height, j) => (
                    <i key={j} style={{ height: `${height}%` }} />
                  ))}
                </div>
              ) : (
                <div className="m-integrations-mini">
                  <PlatformIcon id="google" />
                  <span>+</span>
                  <PlatformIcon id="zapier" />
                  <span>+</span>
                  <PlatformIcon id="slack" />
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
const industries = [
  {
    name: "Local services",
    subtitle: "Make the follow-up feel personal.",
    icon: "01",
    text: "A review link in your appointment follow-up gives every customer an easy next step.",
  },
  {
    name: "Hospitality",
    subtitle: "Leave a warm final impression.",
    icon: "02",
    text: "Place a QR invitation at reception, on a receipt, or in a checkout message.",
  },
  {
    name: "Retail & e-commerce",
    subtitle: "Keep the conversation going.",
    icon: "03",
    text: "Add your review card link to a delivery follow-up or your packaging.",
  },
  {
    name: "Health & wellness",
    subtitle: "Welcome thoughtful experiences.",
    icon: "04",
    text: "Give customers a simple invitation to share feedback at their own pace.",
  },
];
function SolutionsSection() {
  return (
    <section className="m-section m-container">
      <Reveal className="m-section-heading">
        <Eyebrow>For businesses people come back to</Eyebrow>
        <h2>
          Your business is unique.
          <br />
          <span>Your invitation should be, too.</span>
        </h2>
      </Reveal>
      <div className="m-solutions-grid">
        {industries.slice(0, 3).map((item) => (
          <Link
            className="m-solution"
            key={item.name}
            to={`/solutions?industry=${encodeURIComponent(item.name)}`}
          >
            <span>
              {item.icon}
              <ArrowUpRight size={19} />
            </span>
            <h3>{item.name}</h3>
            <p>{item.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
const plans = Object.values(planCatalog).map((plan) => ({
  name: plan.name,
  price: plan.monthly,
  description:
    plan.id === "free"
      ? "A little link to get you started."
      : plan.id === "growth"
        ? "More room for your business to grow."
        : "For a bigger business footprint.",
  features: planFeatures(plan.id),
}));
function PricingSection() {
  return (
    <section className="m-section m-pricing" id="pricing">
      <div className="m-container">
        <Reveal className="m-section-heading">
          <Eyebrow>A plan for your next chapter</Eyebrow>
          <h2>
            Start small.
            <br />
            Make room for what’s next.
          </h2>
          <p>
            Simple monthly pricing. Plan limits are enforced in your workspace;
            paid billing is not connected yet.
          </p>
        </Reveal>
        <div className="m-price-grid">
          {plans.map((plan) => (
            <Reveal
              className={`m-price-card ${plan.name === "Growth" ? "featured" : ""}`}
              key={plan.name}
            >
              {plan.name === "Growth" && (
                <span className="m-plan-ribbon">Room to grow</span>
              )}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="m-price">
                ${plan.price}
                <span>USD / month</span>
              </div>
              <small>
                {plan.price === 0
                  ? "No payment required"
                  : "Monthly pricing · billing not connected"}
              </small>
              <a
                className={`m-button ${plan.name === "Growth" ? "m-primary" : "m-secondary"}`}
                href="/pricing"
              >
                Get started
                <ArrowRight size={16} />
              </a>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
        <p className="m-preview-disclaimer">
          Free accounts have limited access. Paid plans require administrator
          activation; signing up does not trigger a charge.
        </p>
      </div>
    </section>
  );
}
const questions = [
  ["What does Revbaze do?", "Revbaze brings your review destinations into one branded page. Share its link online or download a QR code for customers to scan at your business. Customers choose a platform and leave their review there."],
  ["Can I customize my review page?", "Yes. Choose a layout, add a logo and welcome message, and customize card colors, borders, buttons, and the full-page background. Background options include plain color, gradients, dots, abstract rings, and waves. Growth and Pro also include QR styling, colors, and logos."],
  ["Can I start for free?", "Yes. Choose Free on Pricing, create your account, and confirm your email. Free includes one owned business, one review card, one enabled platform link per card, and a basic QR code. Growth and Pro require paid checkout; there is no free trial."],
  ["What can I see in analytics?", "Overview shows recorded review-page visits and outbound link clicks. Growth and Pro add detailed analytics, filters, comparisons, and CSV exports, with 12 months of history on Growth and 24 on Pro. The public website’s sample dashboard is a demonstration, separate from your business data."],
  ["Does Revbaze collect reviews from other platforms?", "Revbaze directs customers to your chosen external review destinations. It does not aggregate their reviews or ratings. An outbound click indicates a customer opened a review link; it does not verify that they submitted a review."],
  ["Can I manage multiple businesses and invite my team?", "Growth includes two owned businesses, five review cards, and five invited members across your account. Pro includes unlimited owned businesses and review cards, plus 20 invited members. Owners can invite a new email address with Admin, Editor, or Viewer access to a selected business or all currently owned businesses. The member seats are shared across businesses; invited members use the owner’s workspace plan."],
  ["Do integrations send activity automatically?", "Growth and Pro can save integration and webhook configurations. Automatic event delivery, provider authorization, and test requests are not enabled yet. Saving a setup does not activate an automation."],
  ["Do customers need a Revbaze account?", "No. Customers can open a published review page or scan its QR code without signing in to Revbaze. The external review platform may require its own account before they can leave a review."],
];
function FAQ() {
  return (
    <section className="m-section m-container m-faq">
      <div className="m-section-heading">
        <Eyebrow>A few good questions</Eyebrow>
        <h2>A little clarity.</h2>
        <p>Everything you need to know before your first invitation.</p>
        <Link className="m-text-link" to="/contact">
          Get in touch
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div>
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <ChevronDown size={17} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
function FinalCTA() {
  return (
    <section className="m-container m-final-wrap">
      <Reveal className="m-final">
        <div className="m-final-orbit" />
        <Eyebrow>Good experiences deserve to be shared</Eyebrow>
        <h2>
          Make your next invitation
          <br />
          <span>a little more meaningful.</span>
        </h2>
        <p>Your business. Your brand. One beautiful review link.</p>
        <a className="m-button m-primary" href="/pricing">
          Get started with Revbaze
          <ArrowRight size={17} />
        </a>
      </Reveal>
    </section>
  );
}
function ProductPage() {
  return (
    <>
      <PageIntro
        tag="Meet your review-link workspace"
        title="The invitation is simple. The possibilities aren’t."
        text="Create, customize, and share a review card that feels like your business. Take a closer look at the Revbaze experience."
      />
      <section className="m-container m-product-playground">
        <div>
          <Eyebrow>Your business, beautifully presented</Eyebrow>
          <h2>A card that feels like you.</h2>
          <p>
            Try the layout controls and accent swatch. This preview uses the
            same card component as your Revbaze dashboard.
          </p>
          <Actions />
        </div>
        <ProductCard />
      </section>
      <Showcase />
      <HowItWorks />
      <FinalCTA />
    </>
  );
}
function FeaturesPage() {
  const [tab, setTab] = useState("cards");
  return (
    <>
      <PageIntro
        tag="A considered toolkit"
        title="One workspace. Every little detail."
        text="From your first review invitation to a branded QR code, build a consistent experience around your business."
      />
      <section className="m-container m-feature-playground">
        <div
          className="m-feature-tabs"
          role="group"
          aria-label="Product feature previews"
        >
          {features.map((f) => (
            <button
              key={f.id}
              aria-pressed={tab === f.id}
              onClick={() => setTab(f.id)}
            >
              <f.icon size={17} />
              {f.name}
            </button>
          ))}
        </div>
        <div className="m-feature-playground-body">
          <div>
            <span className="m-preview-badge">
              {features.find((f) => f.id === tab)?.preview
                ? "Product preview"
                : "Available in your workspace"}
            </span>
            <h2>{features.find((f) => f.id === tab)?.name}</h2>
            <p>{features.find((f) => f.id === tab)?.text}</p>
            <a className="m-button m-primary" href="/pricing">
              Try Revbaze
              <ArrowRight size={16} />
            </a>
          </div>
          <div>
            {tab === "cards" ? (
              <ProductCard />
            ) : tab === "qr" ? (
              <QRPlayground />
            ) : tab === "platforms" ? (
              <ReviewPlatformsPreview />
            ) : tab === "analytics" ? (
              <DashboardPreview />
            ) : (
              <div className="m-integration-preview">
                {["google", "facebook", "zapier", "slack", "make", "n8n"].map(
                  (id) => (
                    <div key={id}>
                      <PlatformIcon id={id} />
                      <strong>
                        {
                          {
                            google: "Google Reviews",
                            facebook: "Facebook",
                            zapier: "Zapier",
                            slack: "Slack",
                            make: "Make",
                            n8n: "n8n",
                          }[id]
                        }
                      </strong>
                      <span className="m-preview-badge">Demo connection</span>
                      <Check size={17} />
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <FeatureDetails />
    </>
  );
}
function QRPlayground() {
  const [style, setStyle] = useState<"square" | "rounded" | "dots">("square");
  return (
    <div className="m-qr-playground">
      <Suspense
        fallback={<div className="m-loading">Preparing QR preview…</div>}
      >
        <QRPreview url="https://example.com/review-card-demo" style={style} />
      </Suspense>
      <div className="m-preview-controls">
        {(["square", "rounded", "dots"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={style === s}
            onClick={() => setStyle(s)}
          >
            {s === "square" ? "Classic" : s === "rounded" ? "Rounded" : "Dots"}
          </button>
        ))}
      </div>
      <small>Demo QR points to example.com, not a live business card.</small>
    </div>
  );
}
function ReviewPlatformsPreview() {
  const [selected, setSelected] = useState("google");
  const platform = getPlatform(selected);
  return (
    <div className="m-platform-picker">
      <h3>Your review destinations</h3>
      <p>Choose a platform to preview its review link.</p>
      <div role="group" aria-label="Sample review platforms">
        {platforms
          .filter((p) =>
            [
              "google",
              "facebook",
              "trustpilot",
              "yelp",
              "g2",
              "capterra",
            ].includes(p.id),
          )
          .map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected === p.id}
              onClick={() => setSelected(p.id)}
            >
              <PlatformIcon id={p.id} />
              <span>{p.name}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
      </div>
      <div className="m-platform-destination" role="status">
        <strong>{platform.name}</strong>
        <span>{platform.hint}</span>
      </div>
      <small>Sample destinations · add your own links in your workspace</small>
    </div>
  );
}
const comparisonPlans = [
  {
    name: "Free",
    price: planCatalog.free.monthly,
    description: "Your first invitation, beautifully simple.",
    highlights: [
      "1 business workspace",
      "Owner-only access",
      "1 review card",
      "1 platform link per card",
      "Basic QR code generation",
    ],
  },
  {
    name: "Growth",
    price: planCatalog.growth.monthly,
    description: "A thoughtful toolkit for growing businesses.",
    highlights: [
      "2 business workspaces",
      "5 invited members across all businesses",
      "5 review cards",
      "Unlimited platform links",
      "Custom QR codes & 12-month analytics",
      "Card, campaign & business comparisons",
      "Analytics CSV exports",
    ],
  },
  {
    name: "Pro",
    price: planCatalog.pro.monthly,
    description: "More freedom for every part of your business.",
    highlights: [
      "Unlimited businesses & review cards",
      "20 invited members across all businesses",
      "Unlimited platform links",
      "Custom QR codes & 24-month analytics",
      "Card, campaign & business comparisons",
      "Analytics CSV exports",
      "Priority support",
    ],
  },
];
const comparisonRows: { name: string; values: (string | boolean)[] }[] = [
  { name: "Monthly price", values: ["$0", "$10", "$29"] },
  { name: "Businesses per account", values: ["1", "2", "Unlimited"] },
  { name: "Invited members across all businesses", values: ["Owner only", "5", "20"] },
  { name: "Role-based member access", values: [false, true, true] },
  { name: "Review cards", values: ["1", "5", "Unlimited"] },
  {
    name: "Review platform links",
    values: ["1 per card", "Unlimited", "Unlimited"],
  },
  {
    name: "QR code generation",
    values: ["Basic", "Customizable", "Customizable"],
  },
  { name: "Analytics history", values: [false, "12 months", "24 months"] },
  { name: "Customer CSV import", values: [false, true, true] },
  { name: "Integrations & webhooks", values: [false, true, true] },
  { name: "Priority support", values: [false, true, true] },
];
function PricingPage() {
  const [selectionError, setSelectionError] = useState("");
  const choosePlan = (
    event: React.MouseEvent<HTMLAnchorElement>,
    plan: string,
  ) => {
    if (!rememberSignupPlan(plan.toLowerCase() as PlanId)) {
      event.preventDefault();
      setSelectionError(
        "Allow session storage in your browser to select a plan and continue to signup.",
      );
    }
  };
  return (
    <div className="m-plans-page">
      {selectionError && <p className="m-container contact-error" role="alert">{selectionError}</p>}
      <PageIntro
        tag="Simple plans. Room to grow."
        title="The right plan for your next chapter."
        text="Start with one business. Grow at your own pace. Compare the toolkit that fits your next step."
      />
      <section
        className="m-container m-premium-plans"
        aria-label="Monthly pricing plans"
      >
        <div className="m-price-grid">
          {comparisonPlans.map((plan) => (
            <div
              key={plan.name}
              className={`m-price-card ${plan.name === "Growth" ? "featured" : ""}`}
            >
              {plan.name === "Growth" && (
                <span className="m-plan-ribbon">Most Popular</span>
              )}
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <div className="m-price">
                ${plan.price}
                <span>/ month</span>
              </div>
              <small>
                {plan.price
                  ? "USD · Billed monthly"
                  : "Free to get started"}
              </small>
              <a
                className={`m-button ${plan.name === "Growth" ? "m-primary" : "m-secondary"}`}
                href={`/#/signup?plan=${plan.name.toLowerCase()}`}
                onClick={(event) => choosePlan(event, plan.name)}
              >
                {plan.name === "Free"
                  ? "Start for free"
                  : `Choose ${plan.name}`}
                <ArrowRight size={16} />
              </a>
              <ul>
                {plan.highlights.map((feature) => (
                  <li key={feature}>
                    <Check size={15} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="m-preview-disclaimer">
          Plan access limits apply in your workspace. Paid subscriptions are not
          connected; signing up will not charge you. CSV import, webhooks, and
          paid support are planned benefits.
        </p>
      </section>
      <section
        className="m-container m-comparison-section"
        aria-labelledby="comparison-heading"
      >
        <div className="m-comparison-heading">
          <Eyebrow>The details, at a glance</Eyebrow>
          <h2 id="comparison-heading">A clear view of every plan.</h2>
          <p>
            Find the right balance of simplicity, flexibility, and room to grow.
          </p>
        </div>
        <div
          className="m-comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable plan comparison"
        >
          <table className="m-comparison-table">
            <caption className="m-sr-only">
              Revbaze monthly plan features and prices in US dollars
            </caption>
            <thead>
              <tr>
                <th scope="col">Compare features</th>
                {comparisonPlans.map((plan) => (
                  <th
                    scope="col"
                    key={plan.name}
                    className={plan.name === "Growth" ? "m-growth-column" : ""}
                  >
                    <span>{plan.name}</span>
                    <strong>
                      ${plan.price}
                      <small>/ month</small>
                    </strong>
                    {plan.name === "Growth" && (
                      <span className="m-comparison-popular">Most Popular</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className={index === 1 ? "m-growth-column" : ""}
                    >
                      {value === true ? (
                        <span className="m-included">
                          <Check size={17} aria-hidden="true" />
                          <span className="m-sr-only">Included</span>
                        </span>
                      ) : value === false ? (
                        <span className="m-unavailable">
                          <span aria-hidden="true">—</span>
                          <span className="m-sr-only">Not included</span>
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Your next step</th>
                {comparisonPlans.map((plan) => (
                  <td
                    key={plan.name}
                    className={plan.name === "Growth" ? "m-growth-column" : ""}
                  >
                    <a
                      className={`m-button ${plan.name === "Growth" ? "m-primary" : "m-secondary"}`}
                      href={`/#/signup?plan=${plan.name.toLowerCase()}`}
                      onClick={(event) => choosePlan(event, plan.name)}
                    >
                      {plan.name === "Free"
                        ? "Start for free"
                        : `Choose ${plan.name}`}
                      <ArrowRight size={14} />
                    </a>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="m-fair-use">
          <ShieldCheck size={15} />
          Unlimited usage is subject to fair-use limits. Final limits and
          subscription terms will be available before paid plans launch.
        </p>
      </section>
      <section
        className="m-container m-pricing-faq"
        aria-labelledby="pricing-faq-heading"
      >
        <div>
          <Eyebrow>A few helpful answers</Eyebrow>
          <h2 id="pricing-faq-heading">Before you choose.</h2>
        </div>
        <div>
          {[
            [
              "Can I start for free?",
              "Yes. Start with a free account and set up your first business and review card. Free allows one owned business, one review card, and one enabled platform link per card.",
            ],
            [
              "Will choosing Growth or Pro charge me?",
              "After signup and email confirmation, Growth and Pro require paid Stripe checkout before paid-plan access begins. There is no free trial. Subscriptions renew monthly until cancelled. Free does not require checkout.",
            ],
            ["Are team seats shared across businesses?", "Yes. Growth includes five invited members and Pro includes 20 across the owner’s businesses, excluding the owner. Pending invitations reserve a seat. A member with access to multiple businesses counts once. All-business invitations cover the businesses owned when the invitation is sent."],
            ["Can I cancel or request a refund?", "Owners can manage subscriptions through Settings → Plans & billing in Revbaze. To request a refund of your first subscription charge, contact us within seven days of that charge. Renewals are excluded from this offer. Requests are reviewed manually; cancellation does not automatically issue a refund."],
            [
              "Is yearly billing available?",
              "Yearly pricing has not been configured. All prices shown are monthly, in US dollars.",
            ],
            [
              "What does unlimited mean?",
              "Pro has no plan quota on owned businesses or review cards. Growth and Pro have no plan quota on enabled platform links per card. Technical validation and acceptable-use rules still apply; “unlimited” does not include unlimited team seats.",
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={17} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <FinalCTA />
    </div>
  );
}
function AboutPage() {
  return (
    <div className="about-page">
      <section className="m-container about-hero">
        <Reveal className="about-hero-copy">
          <Eyebrow>About Revbaze</Eyebrow>
          <h1>
            A little link.
            <br />A closer connection.
          </h1>
          <p>
            Behind every business is an experience worth sharing. We make it
            easier to invite your customers to share theirs.
          </p>
          <Link className="m-button m-primary" to="/product">
            Meet the product <ArrowRight size={18} />
          </Link>
        </Reveal>
        <div
          className="about-art"
          role="img"
          aria-label="Abstract illustration of customer experiences connecting around one review link"
        >
          <div className="about-orbit about-orbit-one" />
          <div className="about-orbit about-orbit-two" />
          <div className="about-art-center">
            <Link2 size={36} />
            <strong>One little link</strong>
            <span>More room for connection</span>
          </div>
          <div className="about-note about-note-one">
            <Heart size={20} />
            <span>Every experience matters</span>
          </div>
          <div className="about-note about-note-two">
            <MessageSquare size={20} />
            <span>A space for honest feedback</span>
          </div>
          <div className="about-note about-note-three">
            <Check size={20} />
            <span>Simple to share</span>
          </div>
          <span className="about-art-caption">
            Your business. Your customers. Connected.
          </span>
        </div>
      </section>
      <section className="m-container about-story">
        <Reveal>
          <Eyebrow>Why we’re here</Eyebrow>
          <h2>Good feedback shouldn’t start with a search.</h2>
        </Reveal>
        <Reveal className="about-story-copy">
          <p>
            Your customers can find your business in many places. Asking them
            for feedback should feel simple, wherever they choose to share it.
          </p>
          <p>
            Revbaze brings your review destinations into one branded page. Share
            a link, put a QR code where it’s useful, and give customers a clear
            next step.
          </p>
          <p>
            We’re building a workspace that keeps the invitation thoughtful and
            the everyday work manageable.
          </p>
        </Reveal>
      </section>
      <section className="about-principles-wrap">
        <div className="m-container">
          <Reveal className="about-section-heading">
            <Eyebrow>What guides us</Eyebrow>
            <h2>
              Thoughtful by design.
              <br />
              Honest by default.
            </h2>
            <p>A few simple principles shape the experience.</p>
          </Reveal>
          <div className="about-principles">
            {[
              [
                "01",
                "Everyone gets an invitation",
                "Every customer deserves the same opportunity to share their experience. Review destinations aren’t filtered by how someone feels.",
              ],
              [
                "02",
                "Clarity comes first",
                "A click tells you someone visited a review destination. It doesn’t prove they posted a review. We keep that distinction clear.",
              ],
              [
                "03",
                "Your business feels like you",
                "Your brand belongs in the invitation. A readable page, familiar colors, and clear choices help customers find their way.",
              ],
            ].map(([number, title, text]) => (
              <Reveal className="about-principle" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="m-container about-purpose">
        <div className="about-purpose-art" aria-hidden="true">
          <div />
          <div />
          <div />
          <span>
            <Link2 size={40} />
          </span>
        </div>
        <Reveal>
          <Eyebrow>From invitation to understanding</Eyebrow>
          <h2>
            Less time managing links.
            <br />
            More time for your business.
          </h2>
          <p>
            Create a review card, connect your platforms, and share it with your
            customers. When you’re ready to look closer, analytics help you
            understand visits and outbound clicks.
          </p>
          <Link className="m-text-link" to="/features">
            Explore what you can do <ArrowRight size={18} />
          </Link>
        </Reveal>
      </section>
      <FinalCTA />
    </div>
  );
}
function Footer() {
  return (
    <footer className="m-footer">
      <div className="m-container m-footer-grid">
        <div>
          <Brand />
          <p>
            One link. Every review platform.
            <br />A little invitation to honest feedback.
          </p>
          <span className="m-footer-mark">
            <Link2 size={40} />
          </span>
        </div>
        {[
          {
            title: "Product",
            items: [
              ["Product", "/product"],
              ["Features", "/features"],
              ["Pricing", "/pricing"],
            ],
          },
          {
            title: "Explore",
            items: [
              ["Solutions", "/solutions"],
              ["Resources", "/resources"],
              ["About", "/about"],
            ],
          },
          {
            title: "Get in touch",
            items: [
              ["Contact", "/contact"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ],
          },
        ].map((group) => (
          <nav key={group.title} aria-label={`${group.title} footer links`}>
            <strong>{group.title}</strong>
            {group.items.map(([name, to]) => (
              <Link key={to} to={to}>
                {name}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="m-container m-footer-bottom">
        <span>© {currentYear} Revbaze</span>
        <span>Built for the businesses people love.</span>
        <a href="/#/login">
          Go to your workspace
          <ArrowUpRight size={14} />
        </a>
      </div>
    </footer>
  );
}
