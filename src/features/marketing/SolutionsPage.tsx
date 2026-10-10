import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Heart,
  Link2,
  LoaderCircle,
  MessageSquare,
  QrCode,
} from "lucide-react";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import type { ReactNode } from "react";
import "./solutions.css";
const QRPreview = lazy(() =>
  import("../qr-codes/QRPreview").then((module) => ({
    default: module.QRPreview,
  })),
);
type Industry = { name: string; subtitle: string; text: string };
const examples: Record<
  string,
  { business: string; moment: string; invitation: string; places: string[] }
> = {
  "Local services": {
    business: "Northside Studio",
    moment: "After the appointment",
    invitation: "Thanks for choosing us. If you’d like, share your experience.",
    places: ["Appointment follow-up", "Service receipt", "Reception counter"],
  },
  Hospitality: {
    business: "The Haven House",
    moment: "At the end of a stay",
    invitation:
      "Thanks for staying with us. We’d love to hear about your visit.",
    places: ["Checkout message", "Reception desk", "Guest information card"],
  },
  "Retail & e-commerce": {
    business: "Everyday Goods",
    moment: "After the delivery",
    invitation:
      "Thanks for your order. Tell others about your experience, whenever you’re ready.",
    places: ["Delivery follow-up", "Packaging insert", "Store counter"],
  },
  "Health & wellness": {
    business: "Willow Wellness",
    moment: "When the customer is ready",
    invitation:
      "Thank you for visiting. Sharing your experience is always your choice.",
    places: ["Visit follow-up", "Welcome desk", "Take-home information"],
  },
};
function AnimatedScene({
  children,
  className = "",
}: {
  children: (active: boolean, reduced: boolean) => ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    let inView = false;
    const update = () => setActive(inView && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        update();
      },
      { threshold: 0.25 },
    );
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!active || reduced) return;
    const timer = setInterval(() => setCycle((value) => value + 1), 7500);
    return () => clearInterval(timer);
  }, [active, reduced]);
  return (
    <div
      ref={root}
      className={`solution-scene ${className}`}
      data-active={active}
      data-reduced={reduced}
    >
      <div
        className="solution-scene-content"
        key={`${cycle}-${active}-${reduced}`}
      >
        {children(active, reduced)}
      </div>
      <span className="solution-demo-label">
        Illustrative demo · sample business and data
      </span>
    </div>
  );
}
function SampleCount({
  value,
  active,
  reduced,
}: {
  value: number;
  active: boolean;
  reduced: boolean;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 2000, 1);
      setCount(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, active, reduced]);
  return <>{reduced ? value : count}</>;
}
export function SolutionsPage({ industries }: { industries: Industry[] }) {
  const { search } = useLocation();
  const requested = new URLSearchParams(search).get("industry");
  const [choice, setChoice] = useState<{
    request: string | null;
    name: string;
  } | null>(null);
  const selected =
    choice?.request === requested
      ? choice.name
      : industries.find((industry) => industry.name === requested)?.name ||
        industries[0].name;
  const item = industries.find((industry) => industry.name === selected)!;
  const example = examples[selected];
  return (
    <div className="solutions-page">
      <section className="m-container solutions-hero">
        <div>
          <span className="solution-eyebrow">FOR THE WAY YOU DO BUSINESS</span>
          <h1>
            The right invitation.
            <br />
            At the right moment.
          </h1>
          <p>
            From the counter to the follow-up message, give your customers one
            simple way to share their experience.
          </p>
          <Link className="m-button m-primary" to="/pricing">
            Find your plan <ArrowRight size={18} />
          </Link>
        </div>
        <div className="solution-hero-art" aria-hidden="true">
          <div className="solution-hero-ring" />
          <span className="solution-hero-link">
            <Link2 size={42} />
          </span>
          <span className="solution-hero-note solution-hero-note-one">
            <MessageSquare size={21} />
            After a visit
          </span>
          <span className="solution-hero-note solution-hero-note-two">
            <QrCode size={21} />
            At your counter
          </span>
          <span className="solution-hero-note solution-hero-note-three">
            <Heart size={21} />
            Every experience
          </span>
          <strong>One link. Many meaningful moments.</strong>
        </div>
      </section>
      <section
        className="m-container solution-industries"
        aria-labelledby="solution-industries-heading"
      >
        <span className="solution-eyebrow">BUILT AROUND YOUR EVERYDAY</span>
        <h2 id="solution-industries-heading">
          Make it part of your customer experience.
        </h2>
        <div
          className="solution-industry-tabs"
          role="group"
          aria-label="Choose your business type"
        >
          {industries.map((industry) => (
            <button
              key={industry.name}
              aria-pressed={selected === industry.name}
              onClick={() =>
                setChoice({ request: requested, name: industry.name })
              }
            >
              {industry.name}
            </button>
          ))}
        </div>
        <div className="solution-industry-detail" key={selected}>
          <div>
            <span className="solution-eyebrow">{item.name}</span>
            <h3>{item.subtitle}</h3>
            <p>{item.text}</p>
            <span className="solution-placement-label">
              A few places to start
            </span>
            <div className="solution-placements">
              {example.places.map((place) => (
                <span key={place}>
                  <Check size={16} />
                  {place}
                </span>
              ))}
            </div>
            <Link
              className="solution-text-link"
              to="/resources/sharing-your-link"
            >
              Explore thoughtful ways to share <ArrowRight size={17} />
            </Link>
          </div>
          <div className="solution-message-preview">
            <span className="solution-message-heading">
              <MessageSquare size={18} />
              {example.moment}
            </span>
            <div className="solution-message-bubble">
              <strong>{example.business}</strong>
              <p>{example.invitation}</p>
              <span>
                <Link2 size={15} />
                Your branded review link
              </span>
            </div>
            <small>Example invitation · fictional business</small>
          </div>
        </div>
      </section>
      <section className="solution-journey-wrap">
        <div className="m-container">
          <header className="solution-journey-heading">
            <span className="solution-eyebrow">FROM INVITATION TO INSIGHT</span>
            <h2>
              A simple flow.
              <br />A thoughtful experience.
            </h2>
            <p>
              See how your brand, your sharing moments, and your activity come
              together.
            </p>
          </header>
          <section className="solution-journey-row">
            <div className="solution-journey-copy">
              <span className="solution-step">01 / MAKE IT YOURS</span>
              <h3>
                Your brand.
                <br />
                Their next step.
              </h3>
              <p>
                Bring your review destinations into a page that feels familiar.
                Use your business identity and a clear invitation, then let
                customers choose where to share.
              </p>
              <Link className="solution-text-link" to="/resources/review-links">
                Build your invitation <ArrowRight size={17} />
              </Link>
            </div>
            <AnimatedScene>
              {() => (
                <div className="solution-card-demo">
                  <div className="solution-demo-business">
                    <span>N.</span>
                    <div>
                      <strong>Northside Studio</strong>
                      <small>Your local studio</small>
                    </div>
                    <Check size={18} />
                  </div>
                  <div className="solution-demo-welcome">
                    <h4>How was your visit?</h4>
                    <p>We’d love to hear your experience.</p>
                  </div>
                  <div className="solution-demo-platforms">
                    {["google", "facebook", "trustpilot"].map(
                      (platform, index) => (
                        <div
                          key={platform}
                          className={`solution-demo-platform solution-delay-${index}`}
                        >
                          <PlatformIcon id={platform} />
                          <span>
                            {platform === "google"
                              ? "Google Reviews"
                              : platform === "facebook"
                                ? "Facebook"
                                : "Trustpilot"}
                          </span>
                          <ArrowRight size={15} />
                        </div>
                      ),
                    )}
                  </div>
                  <small>Your experience. Your choice.</small>
                </div>
              )}
            </AnimatedScene>
          </section>
          <section className="solution-journey-row solution-journey-reverse">
            <div className="solution-journey-copy">
              <span className="solution-step">02 / SHARE IN THE MOMENT</span>
              <h3>
                A little link.
                <br />
                Online or offline.
              </h3>
              <p>
                Use your public link in a message or download a QR code for your
                physical space. Keep the invitation close to the experience,
                without adding extra steps.
              </p>
              <Link className="solution-text-link" to="/resources/qr-codes">
                Take your link offline <ArrowRight size={17} />
              </Link>
            </div>
            <AnimatedScene className="solution-share-scene">
              {() => (
                <div className="solution-qr-demo">
                  <div className="solution-qr-status">
                    <span className="solution-qr-loading">
                      <LoaderCircle size={25} />
                      <span>Preparing your invitation…</span>
                    </span>
                    <span className="solution-qr-ready">
                      <Check size={24} />
                      <span>Ready to share</span>
                    </span>
                  </div>
                  <div className="solution-qr-paper">
                    <strong>Thanks for stopping by.</strong>
                    <span>Scan to share your experience.</span>
                    <Suspense
                      fallback={
                        <span className="solution-qr-placeholder">
                          Loading sample QR…
                        </span>
                      }
                    >
                      <QRPreview url="https://example.com/revbaze-demo" />
                    </Suspense>
                    <small>Sample QR · example.com</small>
                  </div>
                  <div className="solution-share-chip">
                    <Link2 size={16} />
                    One invitation. Anywhere you share.
                  </div>
                </div>
              )}
            </AnimatedScene>
          </section>
          <section className="solution-journey-row">
            <div className="solution-journey-copy">
              <span className="solution-step">
                03 / UNDERSTAND THE ACTIVITY
              </span>
              <h3>
                See what happens
                <br />
                after you share.
              </h3>
              <p>
                Explore page views and outbound clicks, then compare activity
                across cards and sharing sources. Look for useful patterns and
                decide where to focus next.
              </p>
              <p className="solution-plan-note">
                Detailed analytics are available on Growth and Pro. Clicks don’t
                confirm completed reviews.
              </p>
              <Link
                className="solution-text-link"
                to="/resources/understanding-analytics"
              >
                Get to know your metrics <ArrowRight size={17} />
              </Link>
            </div>
            <AnimatedScene className="solution-insight-scene">
              {(active, reduced) => (
                <div className="solution-insight-demo">
                  <header>
                    <strong>Invitation activity</strong>
                    <span>Sample week</span>
                  </header>
                  <div className="solution-sample-metrics">
                    <div>
                      <span>Page views</span>
                      <strong>
                        <SampleCount
                          value={128}
                          active={active}
                          reduced={reduced}
                        />
                      </strong>
                    </div>
                    <div>
                      <span>Outbound clicks</span>
                      <strong>
                        <SampleCount
                          value={42}
                          active={active}
                          reduced={reduced}
                        />
                      </strong>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 360 160"
                    role="img"
                    aria-label="Illustrative activity graph, not actual customer data"
                  >
                    <defs>
                      <linearGradient
                        id="solution-chart-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#335c87"
                          stopOpacity=".3"
                        />
                        <stop
                          offset="100%"
                          stopColor="#335c87"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    {[30, 70, 110, 150].map((y) => (
                      <path
                        key={y}
                        d={`M10 ${y} H350`}
                        stroke="#e2e9f1"
                        strokeDasharray="3 5"
                      />
                    ))}
                    <path
                      className="solution-chart-area"
                      d="M10 135 C40 135 45 105 70 110 S110 145 135 85 S190 115 210 65 S260 90 285 45 S320 65 350 20 L350 150 L10 150 Z"
                      fill="url(#solution-chart-fill)"
                    />
                    <path
                      className="solution-chart-line"
                      pathLength="1"
                      d="M10 135 C40 135 45 105 70 110 S110 145 135 85 S190 115 210 65 S260 90 285 45 S320 65 350 20"
                      stroke="#042751"
                      strokeWidth="3"
                      fill="none"
                    />
                    <path
                      className="solution-chart-line solution-chart-line-second"
                      pathLength="1"
                      d="M10 145 C45 145 55 130 85 135 S145 150 180 115 S240 130 270 105 S320 110 350 80"
                      stroke="#5a9d8a"
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                  <div className="solution-chart-days">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <span key={day}>{day}</span>
                      ),
                    )}
                  </div>
                  <div className="solution-chart-legend">
                    <span>
                      <i />
                      Page views
                    </span>
                    <span>
                      <i />
                      Outbound clicks
                    </span>
                  </div>
                </div>
              )}
            </AnimatedScene>
          </section>
        </div>
      </section>
      <section className="m-container solution-principles">
        <div>
          <Heart size={25} />
          <h3>Every customer is welcome.</h3>
          <p>
            Offer the same invitation and review choices, whatever someone’s
            experience.
          </p>
        </div>
        <div>
          <Link2 size={25} />
          <h3>Keep the next step clear.</h3>
          <p>
            Give customers one familiar place to find your review destinations.
          </p>
        </div>
        <div>
          <Check size={25} />
          <h3>Stay grounded in real activity.</h3>
          <p>
            Understand visits and clicks without treating them as completed
            reviews.
          </p>
        </div>
      </section>
      <section className="m-container solution-final">
        <div>
          <span className="solution-eyebrow">
            YOUR NEXT INVITATION STARTS HERE
          </span>
          <h2>
            Make it simple.
            <br />
            Make it feel like you.
          </h2>
          <p>
            Build your first review card and choose the moments that matter for
            your business.
          </p>
          <a className="m-button m-primary" href="/pricing">
            Get started with Revbaze <ArrowRight size={18} />
          </a>
        </div>
        <div className="solution-final-art" aria-hidden="true">
          <Link2 size={65} />
        </div>
      </section>
    </div>
  );
}
