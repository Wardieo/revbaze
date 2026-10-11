import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  LoaderCircle,
  Link2,
  MousePointerClick,
} from "lucide-react";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import "./how-it-works.css";
const QRPreview = lazy(() =>
  import("../qr-codes/QRPreview").then((m) => ({ default: m.QRPreview })),
);
function CountingNumber({
  value,
  reduced,
}: {
  value: number;
  reduced: boolean;
}) {
  const [count, setCount] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1800);
      setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span className="walkthrough-count">{reduced ? value : count}</span>;
}
function QRReveal({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState(reduced ? 2 : 0);
  useEffect(() => {
    if (reduced) return;
    const check = setTimeout(() => setPhase(1), 1000);
    const reveal = setTimeout(() => setPhase(2), 1800);
    return () => {
      clearTimeout(check);
      clearTimeout(reveal);
    };
  }, [reduced]);
  return (
    <div className={`walkthrough-qr-reveal phase-${reduced ? 2 : phase}`}>
      <div className="walkthrough-qr-progress" role="status">
        {phase === 0 ? (
          <>
            <LoaderCircle className="walkthrough-spinner" size={30} />
            <span>Creating your QR code…</span>
          </>
        ) : (
          <>
            <Check size={32} />
            <span>Ready to share</span>
          </>
        )}
      </div>
      <div className="walkthrough-qr-result">
        <Suspense fallback={<div className="walkthrough-qr-placeholder" />}>
          <QRPreview url="https://example.com/revbaze-demo" showEnlarge={false} />
        </Suspense>
      </div>
    </div>
  );
}
const steps = [
  {
    title: "Create",
    text: "Make it yours. Add your business, personalize your invitation, and choose your review destinations.",
  },
  {
    title: "Share",
    text: "One link, wherever customers find you. Share it online or download a QR code for your counter and receipts.",
  },
  {
    title: "Collect feedback",
    text: "Give customers a simple way to share an honest experience on their favorite review platform.",
  },
  {
    title: "Track performance",
    text: "See how your invitation performs. Explore page views, outbound clicks, and the sources behind them.",
  },
];
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [selected, setSelected] = useState("");
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0].isIntersecting),
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!visible || reduced) return;
    const progressRoot = root.current;
    let finishedAt: number | null = null;
    let previousTick = performance.now();
    let elapsed = 0;
    let progress = 0;
    let holdStart = 0;
    progressRoot?.style.setProperty("--walkthrough-progress", "0");
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - previousTick;
      previousTick = now;
      if (document.hidden) { finishedAt = null; return; }
      elapsed += delta;
      const scene = root.current?.querySelector<HTMLElement>(".walkthrough-scene");
      if (!scene) return;
      const qr = scene.querySelector(".walkthrough-qr-reveal");
      const waitingForQR = qr && (!qr.classList.contains("phase-2") || qr.querySelector(".qr-loading,.walkthrough-qr-placeholder"));
      const animations = scene.getAnimations({ subtree: true }).filter(animation =>
        animation.effect?.getTiming().iterations !== Infinity &&
        (animation.playState === "running" || animation.pending));
      if (waitingForQR || animations.length) {
        finishedAt = null;
        const remaining = Math.max(waitingForQR ? 1000 : 0, ...animations.map(animation => {
          const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
          const current = Number(animation.currentTime ?? 0);
          return Number.isFinite(end) ? Math.max(0, end - current) : 0;
        }));
        progress = Math.max(progress, Math.min(.8, elapsed / (elapsed + remaining + 2000)));
      } else {
        if (finishedAt === null) { finishedAt = now; holdStart = progress; }
        progress = holdStart + (1 - holdStart) * Math.min(1, (now - finishedAt) / 2000);
      }
      progressRoot?.style.setProperty("--walkthrough-progress", String(progress));
      if (finishedAt !== null && now - finishedAt >= 2000) {
        clearInterval(timer);
        setActive((n) => (n + 1) % steps.length);
        setSelected("");
      }
    }, 100);
    return () => {
      clearInterval(timer);
      progressRoot?.style.removeProperty("--walkthrough-progress");
    };
  }, [visible, reduced, active]);
  function choose(index: number) {
    setActive(index);
    setSelected("");
  }
  return (
    <section
      ref={root}
      className="m-section m-container"
      aria-label="How Revbaze works"
    >
      <div className="walkthrough">
        <div className="walkthrough-copy">
          <span className="walkthrough-eyebrow">
            FROM INVITATION TO INSIGHT
          </span>
          <h2>
            One little link.
            <br />
            Four simple steps.
          </h2>
          <div
            className="walkthrough-steps"
            role="tablist"
            aria-label="Product walkthrough"
          >
            {steps.map((step, index) => (
              <div
                className={`walkthrough-step ${index === active ? "active" : ""}`}
                key={step.title}
              >
                <button
                  id={`walkthrough-tab-${index}`}
                  role="tab"
                  aria-selected={index === active}
                  aria-controls="walkthrough-preview"
                  tabIndex={index === active ? 0 : -1}
                  onClick={() => choose(index)}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowDown",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowLeft",
                        "Home",
                        "End",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      const next =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 3
                            : (index +
                                (e.key === "ArrowDown" || e.key === "ArrowRight"
                                  ? 1
                                  : 3)) %
                              4;
                      choose(next);
                      document
                        .getElementById(`walkthrough-tab-${next}`)
                        ?.focus();
                    }
                  }}
                >
                  <span>0{index + 1}</span>
                  {step.title}
                </button>
                {index === active && <p>{step.text}</p>}
              </div>
            ))}
          </div>
        </div>
        <div
          className="walkthrough-stage"
          id="walkthrough-preview"
          role="tabpanel"
          aria-labelledby={`walkthrough-tab-${active}`}
        >
          <div key={`${active}-${visible}`} className={`walkthrough-scene scene-${active}`}>
            {active === 0 && (
              <>
                <div className="walkthrough-panel">
                  <span className="walkthrough-panel-label">YOUR BUSINESS</span>
                  <h3>
                    A little personality.
                    <br />A lasting invitation.
                  </h3>
                  <label>
                    Business name
                    <div className="walkthrough-demo-input">
                      Studio North
                      <span className="walkthrough-caret" />
                    </div>
                  </label>
                  <label>
                    Your headline
                    <div className="walkthrough-demo-input">
                      Your experience matters.
                    </div>
                  </label>
                </div>
                <div className="walkthrough-panel walkthrough-small-panel">
                  <strong>Made to feel like you</strong>
                  <div className="walkthrough-swatches">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="walkthrough-confirm">
                    <Check size={14} />
                    Branding preview
                  </span>
                </div>
                <div className="walkthrough-panel">
                  <strong>Your destinations</strong>
                  {["google", "facebook"].map((id) => (
                    <div className="walkthrough-provider" key={id}>
                      <PlatformIcon id={id} />
                      <span>
                        {id === "google" ? "Google Reviews" : "Facebook"}
                      </span>
                      <Check size={16} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {active === 1 && (
              <div className="walkthrough-panel walkthrough-share-panel">
                <span className="walkthrough-link-badge">
                  <Link2 size={24} />
                </span>
                <h3>Ready to meet your customers.</h3>
                <p>Scan. Tap. Share an experience.</p>
                <QRReveal reduced={reduced} />
                <button
                  className="walkthrough-demo-link"
                  onClick={() => {
                    setSelected("shared");
                  }}
                >
                  <span>revbaze.com / studio-north</span>
                  {selected ? <Check size={17} /> : <Copy size={17} />}
                </button>
                <small role="status">
                  {selected
                    ? "Demo link selected — your real link is created after setup."
                    : "Demo QR code · illustrative destination"}
                </small>
              </div>
            )}
            {active === 2 && (
              <div className="walkthrough-panel walkthrough-customer">
                <div className="walkthrough-avatar">N.</div>
                <span className="walkthrough-panel-label">STUDIO NORTH</span>
                <h3>Your experience matters.</h3>
                <p>Choose a platform and share your experience with us.</p>
                {["google", "facebook", "trustpilot"].map((id) => (
                  <button
                    key={id}
                    onClick={() => {
                      setSelected(id);
                    }}
                    className={`walkthrough-review-button ${selected === id ? "selected" : ""}`}
                  >
                    <PlatformIcon id={id} />
                    <span>
                      {id === "google"
                        ? "Google Reviews"
                        : id === "facebook"
                          ? "Facebook"
                          : "Trustpilot"}
                    </span>
                    {selected === id ? (
                      <Check size={17} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </button>
                ))}
                <small role="status">
                  {selected
                    ? "Destination selected in this demo. No review or click is recorded."
                    : "Every experience is welcome."}
                </small>
              </div>
            )}
            {active === 3 && (
              <div className="walkthrough-panel walkthrough-analytics">
                <span className="walkthrough-panel-label">
                  AN INVITATION IN MOTION
                </span>
                <h3>See the story behind your link.</h3>
                <div className="walkthrough-stat-pair">
                  <div>
                    <span>Sample page views</span>
                    <strong>
                      <CountingNumber value={128} reduced={reduced} />
                    </strong>
                  </div>
                  <div>
                    <span>Sample outbound clicks</span>
                    <strong>
                      <CountingNumber value={42} reduced={reduced} />
                    </strong>
                  </div>
                </div>
                <svg
                  viewBox="0 0 460 190"
                  role="img"
                  aria-label="Illustrative views and outbound clicks increasing over one week"
                >
                  <defs>
                    <linearGradient
                      id="walkthrough-fill"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#042751" stopOpacity=".2" />
                      <stop offset="1" stopColor="#042751" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[35, 80, 125, 170].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      x2="460"
                      y1={y}
                      y2={y}
                      stroke="#e3e9f2"
                      strokeDasharray="3 5"
                    />
                  ))}
                  <path
                    d="M0 160 C60 165 45 105 110 120 S180 140 230 85 S300 115 340 65 S410 50 460 15 L460 190 L0 190Z"
                    fill="url(#walkthrough-fill)"
                  />
                  <path
                    className="walkthrough-chart-line"
                    d="M0 160 C60 165 45 105 110 120 S180 140 230 85 S300 115 340 65 S410 50 460 15"
                    fill="none"
                    stroke="#042751"
                    strokeWidth="3"
                  />
                  <path
                    className="walkthrough-chart-line"
                    d="M0 180 C60 175 90 150 140 160 S240 140 300 130 S400 110 460 80"
                    fill="none"
                    stroke="#55b69e"
                    strokeWidth="3"
                  />
                </svg>
                <div className="walkthrough-chart-dates">
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                  <span>Sun</span>
                </div>
                <span className="walkthrough-confirm">
                  <MousePointerClick size={15} />
                  Clicks measure engagement, not confirmed reviews.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
