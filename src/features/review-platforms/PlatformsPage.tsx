import { useWorkspaceRole } from "../../hooks/useWorkspaceRole";
import "./platforms.css";
import { usePlan } from "../../hooks/usePlan";
import { Toggle } from "../../components/ui/Toggle";
import { useFeedback } from "../../hooks/useFeedback";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  Link2,
  ArrowUpRight,
  CircleCheck,
  PanelsTopLeft,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  PageHeading,
} from "../../components/shared/Feedback";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import { useWorkspace } from "../../stores/workspace";
import { getPlatform, platforms } from "../../lib/platforms";
import { validateDestination } from "../../lib/validation";
import type { ReviewLink } from "../../types/workspace";
export function PlatformForm({
  editing,
  close,
  onSaved,
}: {
  editing?: ReviewLink;
  close: () => void;
  onSaved?: (link: ReviewLink) => void;
}) {
  const business = useWorkspace((s) => s.business);
  const busy = useWorkspace((s) => s.busy);
  const save = useWorkspace((s) => s.saveLink);
  const notify = useFeedback();
  const [platform, setPlatform] = useState(editing?.platform_id || "google");
  const [name, setName] = useState(
    editing?.display_name || getPlatform(platform).name,
  );
  const [url, setUrl] = useState(editing?.destination_url || "");
  const [active, setActive] = useState(editing?.is_active ?? true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    url?: string;
  }>({});
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  return (
    <Dialog
      title={editing ? "Edit review platform" : "Add a review platform"}
      close={close}
    >
      <div className="platform-form-identity">
        <PlatformIcon id={platform} />
        <div>
          <strong>{getPlatform(platform).name}</strong>
          <p>Add a destination customers can visit to leave a review.</p>
        </div>
      </div>
      {editing && (
        <p className="form-help">
          Changes apply to every review card using this destination. If you
          change the platform, update its URL too.
        </p>
      )}
      <form
        className="stack-form platform-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!business) {
            setError("Set up your business first.");
            return;
          }
          const issues: typeof fieldErrors = {};
          if (!name.trim())
            issues.name = "Enter a display name for this destination.";
          let destination = "";
          try {
            destination = validateDestination(url, platform);
          } catch (err) {
            issues.url =
              err instanceof Error
                ? err.message
                : "Enter a valid HTTPS destination.";
          }
          setFieldErrors(issues);
          setError("");
          if (issues.name || issues.url) {
            (
              e.currentTarget.querySelector(
                issues.name ? "#platform-name" : "#platform-url",
              ) as HTMLInputElement
            )?.focus();
            return;
          }
          try {
            const link: ReviewLink = {
              id: editing?.id || crypto.randomUUID(),
              business_id: business.id,
              platform_id: platform,
              display_name: name.trim(),
              destination_url: destination,
              is_active: active,
              created_at: editing?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await save(link);
            notify(
              editing
                ? "Review destination updated."
                : "Review platform added.",
            );
            onSaved?.(link);
            close();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save.");
          }
        }}
      >
        <label>
          Review platform
          <select
            value={platform}
            disabled={busy}
            onChange={(e) => {
              if (name === getPlatform(platform).name)
                setName(getPlatform(e.target.value).name);
              setPlatform(e.target.value);
              setFieldErrors({});
              setError("");
            }}
          >
            {platforms.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Display name
          <input
            required
            maxLength={80}
            id="platform-name"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={
              fieldErrors.name ? "platform-name-error" : undefined
            }
            disabled={busy}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFieldErrors((previous) => ({ ...previous, name: undefined }));
            }}
          />
        </label>
        {fieldErrors.name && (
          <p id="platform-name-error" className="form-error" role="alert">
            {fieldErrors.name}
          </p>
        )}
        <label>
          Destination URL
          <input
            required
            type="url"
            id="platform-url"
            aria-invalid={Boolean(fieldErrors.url)}
            aria-describedby={
              fieldErrors.url ? "platform-url-error" : "platform-url-help"
            }
            disabled={busy}
            value={url}
            placeholder={getPlatform(platform).hint}
            onChange={(e) => {
              setUrl(e.target.value);
              setFieldErrors((previous) => ({ ...previous, url: undefined }));
              setError("");
            }}
          />
        </label>
        {fieldErrors.url && (
          <p id="platform-url-error" className="form-error" role="alert">
            {fieldErrors.url}
          </p>
        )}
        <small id="platform-url-help" className="form-help">
          {platform === "custom"
            ? `Custom destination${host ? `: ${host}` : ""}. Customers will see this domain.`
            : `Official domains: ${getPlatform(platform).domains.join(", ")}.`}{" "}
          HTTPS links only. We do not verify that the URL opens a review
          submission form.
        </small>
        <label className="checkbox-label">
          <Toggle
            checked={active}
            disabled={busy}
            onChange={(e) => setActive(e.target.checked)}
          />
          Enable this review destination
        </label>
        <small className="form-help">
          Disabling a card’s last enabled destination also deactivates that
          card. Re-enable the card after restoring its destinations.
        </small>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add platform"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function PlatformsPage({ embedded = false }: { embedded?: boolean }) {
  const permissions = useWorkspaceRole();
  const { links, cards, business, busy, saveLink, deleteLink } = useWorkspace();
  const notify = useFeedback();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<ReviewLink | null | undefined>();
  const [deleting, setDeleting] = useState<ReviewLink | null>(null);
  const access = usePlan();
  const limitReached =
    access.ready && access.plan.id === "free" && links.length >= 1;
  const addPlatform = () => {
    if (!permissions.canEdit) { notify("Your role has view-only access.", true); return; }
    if (limitReached)
      notify(
        "Free includes 1 review platform. Upgrade to Growth to add more.",
        true,
      );
    else setEditing(null);
  };
  const filtered = links.filter(
    (l) =>
      `${l.display_name} ${l.destination_url} ${getPlatform(l.platform_id).name}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (statusFilter === "all" || l.is_active === (statusFilter === "enabled")),
  );
  return (
    <>
      {!embedded && (
        <PageHeading
          title="Every platform, one place"
          description="Add the review links you want your customers to choose from."
        >
          <Button variant="primary" onClick={addPlatform} disabled={!business || !permissions.canEdit}>
            <Plus size={15} />
            Add platform
          </Button>
        </PageHeading>
      )}
      {limitReached && (
        <p className="platform-plan-note">
          Your Free plan includes 1 review platform.{" "}
          <Link to="/upgrade">Upgrade to add more</Link>
        </p>
      )}
      {business && (
        <div className="platform-summary">
          {[
            {
              label: "Total destinations",
              value: links.length,
              icon: Link2,
              detail: "All your review links",
              tone: "blue",
            },
            {
              label: "Enabled",
              value: links.filter((link) => link.is_active).length,
              icon: CircleCheck,
              detail: `${links.filter((link) => !link.is_active).length} disabled destinations`,
              tone: "green",
            },
            {
              label: "Review cards",
              value: cards.length,
              icon: PanelsTopLeft,
              detail: `${cards.filter((card) => card.is_active).length} active cards`,
              tone: "violet",
            },
          ].map(({ label, value, icon: Icon, detail, tone }) => (
            <section className={`platform-summary-card ${tone}`} key={label}>
              <div className="platform-summary-heading">
                <span>{label}</span>
                <i>
                  <Icon size={19} />
                </i>
              </div>
              <strong>{value.toLocaleString()}</strong>
              <p>
                <span className="platform-summary-dot" />
                {detail}
              </p>
            </section>
          ))}
        </div>
      )}
      {!business ? (
        <section className="card">
          <EmptyState
            icon={<Link2 size={25} />}
            title="Start with your business"
            description="Create your business profile before adding review destinations."
          >
            <Button variant="primary" asChild>
              <Link to="/onboarding">
                Set up business <ArrowUpRight size={14} />
              </Link>
            </Button>
          </EmptyState>
        </section>
      ) : (
        <section className="card platforms-panel">
          <div className="table-toolbar">
            <label className="search-input">
              <Search size={15} />
              <input
                placeholder="Search platforms…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter destinations by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All destinations</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <span className="subtle-label">
              {filtered.length} external {links.length === 1 ? "link" : "links"}
            </span>
            {embedded && (
              <Button variant="primary" onClick={addPlatform} disabled={!permissions.canEdit}>
                <Plus size={14} />
                Add platform
              </Button>
            )}
          </div>
          {filtered.length ? (
            <div className="platform-link-list">
              <div className="platform-list-heading" aria-hidden="true">
                <span>Review destination</span>
                <span>Used by</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filtered.map((l) => {
                const usage = cards.filter((c) =>
                  c.links.some(
                    (cl) =>
                      cl.business_review_link_id === l.id && cl.is_enabled,
                  ),
                );
                return (
                  <div className="destination-row" key={l.id}>
                    <PlatformIcon id={l.platform_id} />
                    <div className="destination-details">
                      <strong>{l.display_name}</strong>
                      <span className="destination-provider">
                        {getPlatform(l.platform_id).name}
                      </span>
                      <span className="destination-url">
                        {l.destination_url}
                      </span>
                    </div>
                    <div className="destination-usage">
                      <span>
                        {usage.length}{" "}
                        {usage.length === 1 ? "linked card" : "linked cards"}
                      </span>
                      <div className="used-by">
                        {usage.length ? (
                          usage.map((c) => (
                            <Link key={c.id} to={`/cards/${c.id}/edit`}>
                              {c.name}
                            </Link>
                          ))
                        ) : (
                          <small>Not used by a card yet</small>
                        )}
                      </div>
                    </div>
                    <button
                      role="switch"
                      aria-checked={l.is_active}
                      aria-label={`Enable ${l.display_name}`}
                      className={`switch ${l.is_active ? "on" : ""}`}
                      disabled={busy || !permissions.canEdit}
                      onClick={async () => {
                        try {
                          await saveLink({ ...l, is_active: !l.is_active });
                          notify(
                            l.is_active
                              ? "Platform disabled."
                              : "Platform enabled.",
                          );
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
                      <span />
                    </button>
                    <span
                      className={`status-badge ${l.is_active ? "active" : "inactive"}`}
                    >
                      {l.is_active ? "Enabled" : "Disabled"}
                    </span>
                    <div className="row-actions">
                      <a
                        className="icon-button"
                        href={validateDestination(
                          l.destination_url,
                          l.platform_id,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Test ${l.display_name} destination`}
                        title="Test destination"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${l.display_name}`}
                        disabled={busy || !permissions.canEdit}
                        title="Edit destination"
                        onClick={() => setEditing(l)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${l.display_name}`}
                        disabled={busy || !permissions.canEdit}
                        title="Remove destination"
                        onClick={() => setDeleting(l)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Link2 size={25} />}
              title={
                query || statusFilter !== "all"
                  ? "No matching platforms"
                  : "Your next review starts with a link"
              }
              description={
                query || statusFilter !== "all"
                  ? "Try a different platform name or URL."
                  : "Add your Google, Trustpilot, or other review destinations. No sign-in to those platforms required."
              }
            >
              <Button
                onClick={() =>
                  query || statusFilter !== "all"
                    ? (setQuery(""), setStatusFilter("all"))
                    : addPlatform()
                }
              >
                {query || statusFilter !== "all"
                  ? "Clear filters"
                  : "Add your first platform"}
                <Plus size={14} />
              </Button>
            </EmptyState>
          )}
        </section>
      )}
      {editing !== undefined && (
        <PlatformForm
          key={editing?.id || "new"}
          editing={editing || undefined}
          close={() => setEditing(undefined)}
        />
      )}{" "}
      {deleting && (
        <ConfirmDialog
          title={`Remove ${deleting.display_name}?`}
          description="This destination will also be removed from every card that uses it. Cards with no remaining enabled destinations will become inactive."
          busy={busy}
          close={() => setDeleting(null)}
          confirm={async () => {
            try {
              await deleteLink(deleting.id);
              setDeleting(null);
              notify("Review platform removed.");
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
