import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Search,
  X,
} from "lucide-react";
import { guides } from "./resourceGuides";
import "./resources.css";

type Guide = (typeof guides)[number];
const categories = [
  "All guides",
  ...new Set(guides.map((guide) => guide.category)),
];
function GuideArt({ guide, large = false }: { guide: Guide; large?: boolean }) {
  return (
    <div
      className={`resource-art resource-art-${guide.slug}${large ? " resource-art-large" : ""}`}
      aria-hidden="true"
    >
      <div className="resource-art-orbit" />
      <div className="resource-art-orbit resource-art-orbit-inner" />
      <span className="resource-art-mark">
        <guide.icon size={large ? 48 : 34} strokeWidth={1.5} />
      </span>
      <span className="resource-art-tile resource-art-tile-one" />
      <span className="resource-art-tile resource-art-tile-two" />
      <span className="resource-art-dot" />
    </div>
  );
}
function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link className="resource-guide-card" to={`/resources/${guide.slug}`}>
      <GuideArt guide={guide} />
      <div className="resource-guide-body">
        <span className="resource-category">{guide.category}</span>
        <h3>{guide.title}</h3>
        <p>{guide.text}</p>
        <span className="resource-read">
          Read guide <ArrowUpRight size={17} />
        </span>
      </div>
    </Link>
  );
}
export function ResourcesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All guides");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = guides.filter(
    (guide) =>
      (category === "All guides" || category === guide.category) &&
      terms.every((term) =>
        `${guide.title} ${guide.text} ${guide.category} ${guide.steps.flat().join(" ")}`
          .toLowerCase()
          .includes(term),
      ),
  );
  return (
    <div className="resources-page m-container">
      <section
        className="resource-library"
        aria-labelledby="resource-library-title"
      >
        <div className="resource-library-heading">
          <div>
            <span className="resource-eyebrow">LEARN AT YOUR OWN PACE</span>
            <h1 id="resource-library-title">Find your next step.</h1>
          </div>
          <div className="resource-search">
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search resources"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guides, topics, or questions…"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={17} />
              </button>
            )}
          </div>
        </div>
        <div
          className="resource-filters"
          aria-label="Filter guides by category"
        >
          {categories.map((item) => (
            <button
              key={item}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="resource-result-count" role="status">
          {results.length} {results.length === 1 ? "guide" : "guides"}
          {category !== "All guides" ? ` · ${category}` : " to explore"}
        </p>
        {results.length ? (
          <div className="resource-guide-grid">
            {results.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        ) : (
          <div className="resource-empty">
            <BookOpen size={30} />
            <h3>No guides found</h3>
            <p>Try a different phrase or explore all topics.</p>
            <button
              className="m-button m-secondary"
              onClick={() => {
                setQuery("");
                setCategory("All guides");
              }}
            >
              Show all guides
            </button>
          </div>
        )}
      </section>
      <ResourceHelp />
    </div>
  );
}
function ResourceHelp() {
  return (
    <section className="resource-help">
      <div>
        <span className="resource-eyebrow">A LITTLE MORE HELP</span>
        <h2>Can’t find what you need?</h2>
        <p>
          Send us your question or tell us which guide you’d like to see next.
        </p>
      </div>
      <Link className="m-button m-primary" to="/contact">
        Let’s talk <ArrowRight size={18} />
      </Link>
    </section>
  );
}
function GuideChecklist({ guide }: { guide: Guide }) {
  const [completed, setCompleted] = useState<number[]>([]);
  return (
    <section className="guide-checklist">
      <div>
        <span className="resource-eyebrow">PUT IT INTO PRACTICE</span>
        <h2>Your quick checklist</h2>
        <p>
          Check off each step as you go. This checklist stays here while you
          read.
        </p>
      </div>
      <span className="guide-checklist-progress" role="status">
        {completed.length} of {guide.steps.length} complete
      </span>
      <div>
        {guide.steps.map(([title], index) => (
          <label key={title}>
            <input
              type="checkbox"
              checked={completed.includes(index)}
              onChange={(event) =>
                setCompleted((items) =>
                  event.target.checked
                    ? [...items, index]
                    : items.filter((item) => item !== index),
                )
              }
            />
            <span>{title}</span>
            {completed.includes(index) && (
              <Check size={17} aria-hidden="true" />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
export function GuidePage({ slug }: { slug: string }) {
  const guide = guides.find((item) => item.slug === slug);
  if (!guide)
    return (
      <div className="resources-page m-container resource-not-found">
        <BookOpen size={38} />
        <h1>This guide isn’t here.</h1>
        <p>There’s more to explore in the resource library.</p>
        <Link className="m-button m-primary" to="/resources">
          Back to resources <ArrowRight size={18} />
        </Link>
      </div>
    );
  const related = guides
    .filter((item) => item.slug !== slug)
    .sort(
      (a, b) =>
        Number(b.category === guide.category) -
        Number(a.category === guide.category),
    )
    .slice(0, 2);
  const goToStep = (index: number) => {
    const node = document.getElementById(`guide-step-${index}`);
    node?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    node?.focus({ preventScroll: true });
  };
  return (
    <div className="resources-page guide-page m-container">
      <Link className="guide-back" to="/resources">
        <ArrowLeft size={17} />
        All resources
      </Link>
      <header className="guide-hero">
        <div>
          <span className="resource-eyebrow">{guide.category}</span>
          <h1>{guide.title}</h1>
          <p>{guide.text}</p>
          <span className="guide-meta">
            <BookOpen size={16} />
            Practical guide<span>·</span>
            {guide.steps.length} steps
          </span>
        </div>
        <GuideArt guide={guide} large />
      </header>
      <div className="guide-reading-layout">
        <aside className="guide-contents">
          <span className="resource-eyebrow">IN THIS GUIDE</span>
          <nav aria-label="Guide contents">
            {guide.steps.map(([title], index) => (
              <button key={title} onClick={() => goToStep(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {title}
              </button>
            ))}
          </nav>
          <Link to="/contact">
            Have a question? <ArrowUpRight size={16} />
          </Link>
        </aside>
        <article className="guide-article">
          {guide.steps.map(([title, text], index) => (
            <section id={`guide-step-${index}`} tabIndex={-1} key={title}>
              <span className="guide-step-label">
                STEP {String(index + 1).padStart(2, "0")}
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </section>
          ))}
          <GuideChecklist key={slug} guide={guide} />
          <div className="guide-takeaway">
            <span>
              <Check size={20} />
            </span>
            <div>
              <h3>Keep the customer’s experience at the center.</h3>
              <p>
                A clear, optional invitation gives every customer room to share
                honest feedback. Visits and clicks help you understand the
                invitation; they don’t confirm a completed review.
              </p>
            </div>
          </div>
        </article>
      </div>
      <section className="guide-related">
        <span className="resource-eyebrow">KEEP EXPLORING</span>
        <h2>A little more to learn.</h2>
        <div className="resource-guide-grid">
          {related.map((item) => (
            <GuideCard key={item.slug} guide={item} />
          ))}
        </div>
      </section>
      <ResourceHelp />
    </div>
  );
}
