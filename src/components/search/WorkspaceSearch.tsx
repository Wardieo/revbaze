import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useWorkspace } from "../../stores/workspace";
import "./workspace-search.css";
export function WorkspaceSearch() {
  const cards = useWorkspace((s) => s.cards);
  const links = useWorkspace((s) => s.links);
  const business = useWorkspace((s) => s.business);
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const screens = [
    ["Overview", "/overview", "dashboard page views clicks performance"],
    ["Review cards", "/cards", "cards invitations links"],
    ["Create review card", "/cards/new", "new card editor template appearance"],
    ["Analytics", "/analytics", "statistics visitors traffic sources reports"],
    [
      "Review platforms",
      "/platforms",
      "destinations google facebook trustpilot yelp",
    ],
    ["QR codes", "/qr-codes", "qr scan download print logo style"],
    [
      "Integrations",
      "/integrations",
      "webhooks zapier make n8n slack automation",
    ],
    ["Settings", "/settings", "account settings"],
    ["Profile", "/settings?tab=profile", "name email avatar account"],
    [
      "Business settings",
      "/settings?tab=business",
      "business logo website category",
    ],
    ["Security", "/settings?tab=security", "password security"],
    ["Appearance", "/settings?tab=preferences", "theme dark light preferences"],
    ["Notifications", "/settings?tab=notifications", "notifications alerts"],
    [
      "Plans & billing",
      "/settings?tab=billing",
      "pricing subscription invoices payments free growth pro",
    ],
    ["Your data", "/settings?tab=data", "export data download"],
    ["Upgrade plan", "/upgrade", "upgrade growth pro subscription"],
  ];
  const entries = [
    ...screens.map(([name, path, keywords]) => ({
      id: path,
      name,
      path,
      detail: path,
      description: keywords,
      category: "Screen",
    })),
    ...cards.map((c) => ({
      id: `card-${c.id}`,
      name: c.name,
      path: `/cards/${c.id}/edit`,
      detail: `/${c.slug}`,
      description: c.headline,
      category: "Review card",
    })),
    ...links.map((l) => ({
      id: `platform-${l.id}`,
      name: l.display_name,
      path: "/platforms",
      detail: l.destination_url,
      description: l.platform_id,
      category: "Review platform",
    })),
    ...cards.map((c) => ({
      id: `qr-${c.id}`,
      name: `QR code · ${c.name}`,
      path: `/qr-codes?card=${c.id}`,
      detail: `/${c.slug}`,
      description: "scan print download qr",
      category: "QR code",
    })),
  ];
  const matches = entries
    .filter((item) =>
      terms.every((term) =>
        `${item.name} ${item.detail} ${item.description}`
          .toLowerCase()
          .includes(term),
      ),
    )
    .sort((a, b) => {
      const rank = (name: string) =>
        name.toLowerCase() === query.trim().toLowerCase()
          ? 2
          : name.toLowerCase().startsWith(query.trim().toLowerCase())
            ? 1
            : 0;
      return rank(b.name) - rank(a.name) || a.name.localeCompare(b.name);
    });
  const results = matches.slice(0, 8);
  const showResults = open && terms.length > 0;
  const active = Math.min(index, Math.max(0, results.length - 1));
  function choose(path: string) {
    setOpen(false);
    setQuery("");
    setIndex(0);
    input.current?.blur();
    navigate(path);
  }
  useEffect(() => {
    const click = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", shortcut);
    };
  }, []);
  return (
    <div
      ref={root}
      className="workspace-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div className={`workspace-search-field ${open ? "is-open" : ""}`}>
        <Search size={18} />
        <input
          ref={input}
          role="combobox"
          aria-label="Search workspace"
          aria-expanded={showResults}
          aria-controls="workspace-search-list"
          aria-autocomplete="list"
          aria-activedescendant={
            showResults && results.length
              ? `search-card-${results[active].id}`
              : undefined
          }
          placeholder="Search anything…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setIndex((previous) =>
                results.length
                  ? (previous +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      results.length) %
                    results.length
                  : 0,
              );
            }
            if (e.key === "Enter" && showResults && results[active]) {
              e.preventDefault();
              choose(results[active].path);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setIndex(0);
              input.current?.focus();
            }}
          >
            <X size={15} />
          </button>
        ) : (
          <kbd>⌘ / Ctrl K</kbd>
        )}
      </div>
      {showResults && (
        <div className="workspace-search-panel">
          <div className="workspace-search-heading">
            <div>
              <strong>
                {terms.length ? "Search results" : "Go to a screen"}
              </strong>
              <span>{business?.name || "Current workspace"}</span>
            </div>
            <span className="workspace-search-count">{matches.length}</span>
          </div>
          <div
            id="workspace-search-list"
            role="listbox"
            aria-label="Search results"
            className="workspace-search-list"
          >
            {results.map((card, i) => (
              <button
                type="button"
                role="option"
                aria-selected={active === i}
                id={`search-card-${card.id}`}
                key={card.id}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(card.path)}
              >
                <span className="workspace-search-card">
                  <strong>{card.name}</strong>
                  <small>{card.detail}</small>
                  <span>{card.category}</span>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          {!results.length && (
            <div className="workspace-search-empty">
              <Search size={25} />
              <strong>No results found</strong>
              <p>Try a screen, feature, review card, or platform name.</p>
            </div>
          )}
          <div className="workspace-search-footer">
            <span aria-live="polite">
              {matches.length > 8
                ? "Showing the first 8 matches. Refine your search."
                : `${matches.length} ${matches.length === 1 ? "result" : "results"} found`}
            </span>
            <span>↑ ↓ Navigate · Enter Open · Esc Close</span>
          </div>
        </div>
      )}
    </div>
  );
}
