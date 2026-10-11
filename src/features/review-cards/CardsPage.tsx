import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../hooks/useSession";
import type { CardEvent } from "../../types/workspace";
import { useWorkspaceRole } from "../../hooks/useWorkspaceRole";
import { useDowngradeAccess } from "../../hooks/useDowngradeAccess";
import { useCopyFeedback } from "../../hooks/useCopyFeedback";
import { usePlan } from "../../hooks/usePlan";
import { useFeedback } from "../../hooks/useFeedback";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  PanelsTopLeft,
  Copy,
  Check,
  Pencil,
  Ellipsis,
  QrCode,
  ChartNoAxesCombined,
  Trash2,
  Power,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useWorkspace } from "../../stores/workspace";
import { Button } from "../../components/ui/Button";
import {
  ConfirmDialog,
  EmptyState,
  PageHeading,
} from "../../components/shared/Feedback";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import { cardUrl } from "../../lib/validation";
import { metrics, dateLabel } from "../../lib/analytics";
import type { ReviewCard } from "../../types/workspace";
export function CardsPage() {
  const permissions = useWorkspaceRole();
  const availability = useDowngradeAccess();
  const access = usePlan();
  const cardLimit = access.plan.cards;
  const limitReached =
    access.ready &&
    cardLimit !== null &&
    (access.status?.workspace_cards ?? useWorkspace.getState().cards.length) >=
      cardLimit;
  const { cards, links, events, business, busy, saveCard, deleteCard } =
    useWorkspace();
  const { session } = useSession();
  const performance = useQuery({
    queryKey: ["card-performance", session?.user.id, business?.id],
    enabled: Boolean(
      supabase &&
      session &&
      business &&
      access.ready &&
      access.plan.analyticsMonths,
    ),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("card_performance_summary", {
        p_business_id: business!.id,
      });
      if (error) throw error;
      return data as CardEvent[];
    },
    refetchInterval: 30_000,
  });
  const performanceEvents = supabase ? performance.data || [] : events;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All cards");
  const [menu, setMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [deleting, setDeleting] = useState<ReviewCard | null>(null);
  const [page, setPage] = useState(1);
  const notify = useFeedback();
  const { copiedValue, markCopied } = useCopyFeedback();
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const filtered = cards.filter(
    (c) =>
      (c.name + " " + c.slug)
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (status === "All cards" ||
        (status === "Active" ? c.is_active : !c.is_active)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 6));
  const current = Math.min(page, totalPages);
  // Timestamps are generated inside this user-triggered event handler.
  async function duplicate(card: ReviewCard) {
    try {
      if (!access.ready || limitReached)
        throw new Error(
          "Your plan does not allow another review card. View Plans & billing to upgrade.",
        );
      let slug = `${card.slug.slice(0, 48)}-copy`;
      let i = 2;
      while (cards.some((c) => c.slug === slug))
        slug = `${card.slug.slice(0, 48)}-copy-${i++}`;
      await saveCard({
        ...structuredClone(card),
        id: crypto.randomUUID(),
        name: `${card.name.slice(0, 93)} (copy)`,
        slug,
        is_active: false,
        // eslint-disable-next-line react/purity
        created_at: new Date().toISOString(),
        // eslint-disable-next-line react/purity
        updated_at: new Date().toISOString(),
      });
      notify("Card duplicated as an inactive draft.");
      setMenu(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Unable to duplicate.", true);
    }
  }
  return (
    <>
      {access.isError && (
        <p className="form-error" role="alert">
          {access.error.message}
        </p>
      )}
      <PageHeading
        title="A place for every conversation"
        description="Create, customize, and share your review invitations."
      >
        <Button
          variant="primary"
          asChild
          disabled={!permissions.canEdit || !access.ready}
        >
          <Link
            to={
              limitReached
                ? "/upgrade"
                : business
                  ? "/cards/new"
                  : "/onboarding"
            }
          >
            <Plus size={15} />
            {limitReached ? "View plans" : "Create review card"}
          </Link>
        </Button>
      </PageHeading>
      {limitReached && (
        <p className="form-help">
          Your {access.plan.name} plan allows {cardLimit} review card
          {cardLimit === 1 ? "" : "s"} across all owned businesses. Upgrade to
          create more.
        </p>
      )}
      <section className="card">
        <div className="table-toolbar">
          <label className="search-input">
            <Search size={15} />
            <input
              placeholder="Search your cards…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter card status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["All cards", "Active", "Inactive"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="subtle-label">
            {cards.length} {cards.length === 1 ? "card" : "cards"}
          </span>
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table className="cards-table">
                <thead>
                  <tr>
                    <th>Review card</th>
                    <th>Platforms</th>
                    <th>Page views</th>
                    <th>Link clicks</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice((current - 1) * 6, current * 6)
                    .map((card) => {
                      const stats = metrics(
                        performanceEvents.filter(
                          (e) => e.review_card_id === card.id,
                        ),
                      );
                      const destinations = card.links.filter(
                        (cl) =>
                          cl.is_enabled &&
                          links.some(
                            (l) =>
                              l.id === cl.business_review_link_id &&
                              l.is_active,
                          ),
                      );
                      return (
                        <tr key={card.id}>
                          <td>
                            <Link
                              className="card-name"
                              to={`/cards/${card.id}/edit`}
                            >
                              <span
                                className="mini-card-icon"
                                style={{
                                  color: card.appearance_settings.accent,
                                  background: `${card.appearance_settings.accent}12`,
                                }}
                              >
                                <PanelsTopLeft size={20} />
                              </span>
                              <span>
                                <strong>{card.name}</strong>
                                <small>
                                  {cardUrl(card.slug).replace("https://", "")}
                                </small>
                              </span>
                            </Link>
                          </td>
                          <td>
                            <div className="table-platforms">
                              {destinations.slice(0, 3).map((cl) => (
                                <PlatformIcon
                                  key={cl.business_review_link_id}
                                  small
                                  id={
                                    links.find(
                                      (l) =>
                                        l.id === cl.business_review_link_id,
                                    )!.platform_id
                                  }
                                />
                              ))}
                              <small>{destinations.length}</small>
                            </div>
                          </td>
                          <td>
                            {access.ready &&
                            access.plan.analyticsMonths &&
                            (!supabase || performance.isSuccess)
                              ? stats.views.toLocaleString()
                              : "—"}
                          </td>
                          <td>
                            {access.ready &&
                            access.plan.analyticsMonths &&
                            (!supabase || performance.isSuccess)
                              ? stats.clicks.toLocaleString()
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${card.is_active ? "active" : "inactive"}`}
                            >
                              <i />
                              {availability.data?.cards.find(
                                (c) => c.id === card.id,
                              )?.available === false
                                ? "Paused · upgrade to restore"
                                : card.is_active
                                  ? "Active"
                                  : "Inactive"}
                            </span>
                          </td>
                          <td className="muted">
                            {dateLabel(card.created_at)}
                          </td>
                          <td>
                            <div className="card-row-menu">
                              <button
                                className="icon-button"
                                aria-label={`Actions for ${card.name}`}
                                aria-expanded={menu === card.id}
                                onClick={(e) => {
                                  const bounds =
                                    e.currentTarget.getBoundingClientRect();
                                  setMenuPosition({
                                    left: Math.min(
                                      window.innerWidth - 180,
                                      Math.max(10, bounds.right - 165),
                                    ),
                                    top:
                                      bounds.bottom + 245 > window.innerHeight
                                        ? Math.max(10, bounds.top - 245)
                                        : bounds.bottom + 5,
                                  });
                                  setMenu(menu === card.id ? null : card.id);
                                }}
                              >
                                <Ellipsis size={19} />
                              </button>
                              {menu === card.id &&
                                createPortal(
                                  <>
                                    <button
                                      className="menu-dismiss"
                                      aria-label="Close card actions"
                                      onClick={() => setMenu(null)}
                                    />
                                    <div
                                      className="dropdown-menu"
                                      style={{
                                        position: "fixed",
                                        ...menuPosition,
                                        right: "auto",
                                      }}
                                    >
                                      <Link to={`/cards/${card.id}/edit`}>
                                        <Pencil size={14} />
                                        Edit card
                                      </Link>
                                      <button
                                        disabled={
                                          busy ||
                                          !permissions.canEdit ||
                                          !access.ready ||
                                          limitReached
                                        }
                                        onClick={() => duplicate(card)}
                                      >
                                        <Copy size={14} />
                                        Duplicate
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(
                                              cardUrl(card.slug),
                                            );
                                            markCopied(cardUrl(card.slug));
                                            notify(
                                              card.is_active
                                                ? "Review link copied."
                                                : "Draft link copied. Activate the card before sharing.",
                                            );
                                          } catch {
                                            notify(
                                              "Unable to copy the URL.",
                                              true,
                                            );
                                          }
                                        }}
                                      >
                                        {copiedValue === cardUrl(card.slug) ? (
                                          <Check size={14} />
                                        ) : (
                                          <Copy size={14} />
                                        )}
                                        <span aria-live="polite">
                                          {copiedValue === cardUrl(card.slug)
                                            ? "Copied"
                                            : "Copy URL"}
                                        </span>
                                      </button>
                                      {card.is_active && (
                                        <a
                                          href={cardUrl(card.slug)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => setMenu(null)}
                                        >
                                          <ExternalLink size={14} />
                                          Open review page
                                        </a>
                                      )}
                                      <Link to={`/qr-codes?card=${card.id}`}>
                                        <QrCode size={14} />
                                        QR code
                                      </Link>
                                      <Link to={`/analytics?card=${card.id}`}>
                                        <ChartNoAxesCombined size={14} />
                                        Analytics
                                      </Link>
                                      <button
                                        disabled={busy || !permissions.canEdit}
                                        onClick={async () => {
                                          try {
                                            await saveCard({
                                              ...card,
                                              is_active: !card.is_active,
                                            });
                                            notify(
                                              card.is_active
                                                ? "Card deactivated."
                                                : "Card activated.",
                                            );
                                            setMenu(null);
                                          } catch (err) {
                                            notify(
                                              err instanceof Error
                                                ? err.message
                                                : "Unable to update.",
                                              true,
                                            );
                                          }
                                        }}
                                      >
                                        <Power size={14} />
                                        {card.is_active
                                          ? "Deactivate"
                                          : "Activate"}
                                      </button>
                                      <button
                                        className="danger-text"
                                        onClick={() => {
                                          setDeleting(card);
                                          setMenu(null);
                                        }}
                                      >
                                        <Trash2 size={14} />
                                        Delete card
                                      </button>
                                    </div>
                                  </>,
                                  document.querySelector(".app")!,
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {filtered.length} {filtered.length === 1 ? "card" : "cards"}
              </span>
              <Button
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <span>
                {current} / {totalPages}
              </span>
              <Button
                disabled={current === totalPages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<PanelsTopLeft size={27} />}
            title={
              query || status !== "All cards"
                ? "No cards match your filters"
                : "Your first invitation starts here"
            }
            description={
              query || status !== "All cards"
                ? "Try a different search or status."
                : "One thoughtful card. All your review destinations. Create a card that feels like your business."
            }
          >
            {query || status !== "All cards" ? (
              <Button
                onClick={() => {
                  setQuery("");
                  setStatus("All cards");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                variant="primary"
                asChild
                disabled={!permissions.canEdit || !access.ready}
              >
                <Link
                  to={
                    limitReached
                      ? "/upgrade"
                      : business
                        ? "/cards/new"
                        : "/onboarding"
                  }
                >
                  Create your first card <ArrowRight size={14} />
                </Link>
              </Button>
            )}
          </EmptyState>
        )}
      </section>
      <p className="phase-caption">
        Active cards can be shared with customers. Inactive cards are
        unavailable publicly. Views and clicks require Growth or Pro.
      </p>
      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          description="This removes the card, its QR destination, and its analytics from your workspace. Printed QR codes for this card will no longer have a destination."
          busy={busy}
          close={() => setDeleting(null)}
          confirm={async () => {
            try {
              await deleteCard(deleting.id);
              setDeleting(null);
              notify("Review card deleted.");
            } catch (err) {
              notify(
                err instanceof Error ? err.message : "Unable to delete.",
                true,
              );
            }
          }}
        />
      )}
    </>
  );
}
