import { useWorkspaceRole } from "../../hooks/useWorkspaceRole";
import { useCopyFeedback } from "../../hooks/useCopyFeedback";
import { PlatformForm } from "../review-platforms/PlatformsPage";
import { usePlan } from "../../hooks/usePlan";
import { Toggle } from "../../components/ui/Toggle";
import { useFeedback } from "../../hooks/useFeedback";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  GripVertical,
  Eye,
  PanelLeft,
  ArrowUp,
  ArrowDown,
  Upload,
  Plus,
} from "lucide-react";
import { useWorkspace } from "../../stores/workspace";
import { Button } from "../../components/ui/Button";
import { PageHeading, EmptyState } from "../../components/shared/Feedback";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import { CardPreview } from "./CardPreview";
import { cardPageBackground } from "./cardPageBackground";
import { TemplatePicker } from "../../components/onboarding/TemplatePicker";
import { uploadImage } from "../../services/workspace";
import { cardUrl, cardQRUrl, slugify, validateSlug } from "../../lib/validation";
import type { ReviewCard } from "../../types/workspace";
import { QRCustomizer } from "../../components/onboarding/QRCustomizer";
export function CardEditor({ onComplete }: { onComplete?: () => void }) {
  const permissions = useWorkspaceRole();
  const access = usePlan();
  const { id } = useParams();
  const workspace = useWorkspace();
  const existing = workspace.cards.find((c) => c.id === id);
  const navigate = useNavigate();
  const notify = useFeedback();
  const { copiedValue, markCopied } = useCopyFeedback();
  const [tab, setTab] = useState("Basics");
  const [addingDestination, setAddingDestination] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "slug" | "headline" | "links", string>>
  >({});
  function focusField(field: string) {
    setMobilePreview(false);
    setTab(field === "links" ? "Destinations" : "Basics");
    requestAnimationFrame(() =>
      document.getElementById(`card-${field}`)?.focus(),
    );
  }
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [card, setCard] = useState<ReviewCard>(() => {
    const name = workspace.business?.name.trim().slice(0, 100) || "";
    let baseSlug = slugify(name);
    if (name) {
      try {
        validateSlug(baseSlug);
      } catch {
        baseSlug = `${baseSlug.slice(0, 52) || "business"}-reviews`;
      }
    }
    let defaultSlug = baseSlug;
    let suffix = 2;
    while (
      defaultSlug &&
      workspace.cards.some((saved) => saved.slug === defaultSlug)
    ) {
      defaultSlug = `${baseSlug.slice(0, 50)}-${suffix++}`;
    }
    return existing
      ? structuredClone(existing)
      : {
          id: crypto.randomUUID(),
          business_id: workspace.business?.id || "",
          name,
          slug: defaultSlug,
          headline: "Your experience matters.",
          description:
            "Choose your favorite platform and share your experience with us.",
          appearance_settings: {
            template: "classic",
            business_name: workspace.business?.name || "",
            logo_url: workspace.business?.logo_url || "",
            accent: workspace.business?.brand_color || "#042751",
            background: "#ffffff",
            background_style: "abstract",
            button_style: "outline",
            radius: "rounded",
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          links: workspace.links
            .filter((l) => l.is_active)
            .slice(0, access.plan.linksPerCard ?? undefined)
            .map((l, i) => ({
              business_review_link_id: l.id,
              display_order: i,
              is_enabled: true,
            })),
        };
  });
  function update(values: Partial<ReviewCard>) {
    setCard((c) => ({ ...c, ...values }));
    setError("");
    setFieldErrors((previous) => {
      const next = { ...previous };
      for (const field of Object.keys(values))
        delete next[field as keyof typeof next];
      return next;
    });
  }
  function appearance(values: Partial<ReviewCard["appearance_settings"]>) {
    setCard((c) => ({
      ...c,
      appearance_settings: { ...c.appearance_settings, ...values },
    }));
  }
  function reorder(from: string, to: string) {
    const links = [...card.links];
    const a = links.findIndex((l) => l.business_review_link_id === from),
      b = links.findIndex((l) => l.business_review_link_id === to);
    if (a < 0 || b < 0) return;
    const [moved] = links.splice(a, 1);
    links.splice(b, 0, moved);
    update({ links: links.map((l, i) => ({ ...l, display_order: i })) });
  }
  async function copy() {
    try {
      if (!existing || card.slug !== existing.slug)
        throw new Error(
          "Save your card and URL changes before copying the review link.",
        );
      validateSlug(card.slug);
      await navigator.clipboard.writeText(cardUrl(card.slug));
      markCopied(cardUrl(card.slug));
      notify(
        existing
          ? "Review link copied."
          : "Draft link copied. Save the card before sharing.",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Unable to copy.", true);
    }
  }
  if (!permissions.canEdit) return <section className="card padded"><h2>View-only access</h2><p>Your role can view dashboard activity and analytics. Ask the owner for Editor access to manage review cards.</p><Link to="/cards">Back to review cards</Link></section>;
  if (!workspace.business)
    return (
      <section className="card">
        <EmptyState
          title="Set up your business first"
          description="Your card’s identity starts with your business profile."
        >
          <Button variant="primary" asChild>
            <Link to="/onboarding">Set up business</Link>
          </Button>
        </EmptyState>
      </section>
    );
  if (id && !existing)
    return (
      <EmptyState
        title="Card not found"
        description="It may have been removed or belong to another workspace."
      >
        <Button asChild>
          <Link to="/cards">Back to cards</Link>
        </Button>
      </EmptyState>
    );
  return (
    <>
      {access.isError && (
        <p role="alert" className="form-error">
          {access.error?.message}
        </p>
      )}
      {addingDestination && (
        <PlatformForm
          close={() => setAddingDestination(false)}
          onSaved={(link) => {
            const canEnable =
              link.is_active &&
              (access.plan.linksPerCard === null ||
                card.links.filter((l) => l.is_enabled).length <
                  access.plan.linksPerCard);
            update({
              links: [
                ...card.links,
                {
                  business_review_link_id: link.id,
                  display_order: card.links.length,
                  is_enabled: canEnable,
                },
              ],
            });
            if (link.is_active && !canEnable)
              notify(
                "Destination added. Your card has reached its plan limit; disable another destination or upgrade to enable it.",
              );
          }}
        />
      )}
      <div className="editor-toolbar">
        <div className="editor-back">
          <Link to="/cards">
            <ArrowLeft size={14} />
            Review cards
          </Link>
          <span>{existing ? "Edit card" : "Create a new card"}</span>
        </div>
        <PageHeading
          eyebrow="ONE LINK. EVERY REVIEW PLATFORM."
          title={
            existing ? "Make it yours" : "A little invitation goes a long way"
          }
          description="Create a thoughtful place for your customers to share their experience."
        >
          <Button
            variant="primary"
            disabled={workspace.busy || uploading || !access.ready}
            onClick={async () => {
              const errors: typeof fieldErrors = {};
              if (!card.name.trim())
                errors.name = "Enter a name for this review card.";
              if (!card.slug.trim())
                errors.slug =
                  "Enter a URL slug, for example isora-photo-reviews.";
              else {
                try {
                  validateSlug(card.slug);
                } catch (err) {
                  errors.slug =
                    err instanceof Error
                      ? err.message
                      : "Enter a valid URL slug.";
                }
              }
              if (
                !errors.slug &&
                workspace.cards.some(
                  (saved) => saved.id !== card.id && saved.slug === card.slug,
                )
              )
                errors.slug =
                  "This URL is already used by another card. Choose a different slug.";
              if (!card.headline.trim())
                errors.headline = "Enter a heading for your review card.";
              if (
                card.is_active &&
                !card.links.some(
                  (selected) =>
                    selected.is_enabled &&
                    workspace.links.some(
                      (link) =>
                        link.id === selected.business_review_link_id &&
                        link.is_active,
                    ),
                )
              )
                errors.links =
                  "Choose at least one enabled destination for an active card.";
              setFieldErrors(errors);
              setError("");
              const first = Object.keys(errors)[0];
              if (first) {
                focusField(first);
                return;
              }
              try {
                if (
                  !existing &&
                  access.plan.cards !== null &&
                  (access.status?.workspace_cards ?? workspace.cards.length) >=
                    access.plan.cards
                )
                  throw new Error(
                    "Your review card limit has been reached. Upgrade to add another card.",
                  );
                if (!access.ready)
                  throw new Error(
                    "Plan access is not ready. Please retry after it loads.",
                  );
                if (
                  access.plan.linksPerCard !== null &&
                  card.links.filter((l) => l.is_enabled).length >
                    access.plan.linksPerCard
                )
                  throw new Error(
                    `Your ${access.plan.name} plan allows ${access.plan.linksPerCard} enabled platform links per card.`,
                  );
                await workspace.saveCard({
                  ...card,
                  name: card.name.trim(),
                  updated_at: new Date().toISOString(),
                });
                notify(
                  existing
                    ? "Review card updated."
                    : "Your review card is ready.",
                );
                if (onComplete) onComplete();
                else navigate("/cards");
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "Unable to save.";
                if (
                  /review_cards_slug|slug.*(unique|exists|use)|unique.*slug/i.test(
                    message,
                  )
                ) {
                  setFieldErrors({
                    slug: "This URL is already in use. Choose a different slug.",
                  });
                  focusField("slug");
                } else setError(message);
              }
            }}
          >
            <Check size={15} />
            {workspace.busy
              ? "Saving…"
              : existing
                ? "Save changes"
                : "Create card"}
          </Button>
        </PageHeading>
      </div>
      <div className="mobile-editor-toggle">
        <button
          className={!mobilePreview ? "selected" : ""}
          onClick={() => setMobilePreview(false)}
        >
          <PanelLeft size={15} />
          Edit
        </button>
        <button
          className={mobilePreview ? "selected" : ""}
          onClick={() => setMobilePreview(true)}
        >
          <Eye size={15} />
          Preview
        </button>
      </div>
      <div className="editor-grid">
        <section
          className={`card editor-form ${mobilePreview ? "mobile-hidden" : ""}`}
        >
          <div className="editor-tabs">
            {["Basics", "Destinations", "Appearance", "Sharing"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="editor-fields">
            {tab === "Basics" && (
              <>
                <h2>The essentials</h2>
                <p className="section-description">
                  Give this card a name and a welcoming message.
                </p>
                <label>
                  Card name
                  <input
                    required
                    maxLength={100}
                    id="card-name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "card-name-error" : undefined
                    }
                    value={card.name}
                    placeholder="The everyday invitation"
                    onChange={(e) => {
                      const value = e.target.value;
                      update({
                        name: value,
                        ...(!existing &&
                        (!card.slug || card.slug === slugify(card.name))
                          ? { slug: slugify(value) }
                          : {}),
                      });
                    }}
                  />
                </label>
                {fieldErrors.name && (
                  <p id="card-name-error" className="form-error" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
                <label>
                  Business name
                  <input
                    value={card.appearance_settings.business_name}
                    maxLength={100}
                    onChange={(e) =>
                      appearance({ business_name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Custom URL slug
                  <div className="slug-input">
                    <span>revbaze.com/</span>
                    <input
                      id="card-slug"
                      aria-invalid={Boolean(fieldErrors.slug)}
                      aria-describedby={
                        fieldErrors.slug ? "card-slug-error" : "card-slug-help"
                      }
                      value={card.slug}
                      placeholder="acme-studio"
                      maxLength={60}
                      onChange={(e) => update({ slug: e.target.value })}
                    />
                  </div>
                </label>
                {fieldErrors.slug && (
                  <p id="card-slug-error" className="form-error" role="alert">
                    {fieldErrors.slug}
                  </p>
                )}
                <small id="card-slug-help" className="form-help">
                  Choose a unique URL. Keep it unchanged after printing QR
                  codes.
                </small>
                <label>
                  Heading
                  <input
                    maxLength={120}
                    required
                    id="card-headline"
                    aria-invalid={Boolean(fieldErrors.headline)}
                    aria-describedby={
                      fieldErrors.headline ? "card-headline-error" : undefined
                    }
                    value={card.headline}
                    onChange={(e) => update({ headline: e.target.value })}
                  />
                </label>
                {fieldErrors.headline && (
                  <p
                    id="card-headline-error"
                    className="form-error"
                    role="alert"
                  >
                    {fieldErrors.headline}
                  </p>
                )}
                <label>
                  Supporting description
                  <textarea
                    maxLength={500}
                    value={card.description}
                    onChange={(e) => update({ description: e.target.value })}
                  />
                </label>
                <label className="checkbox-label">
                  <Toggle
                    checked={card.is_active}
                    onChange={(e) => update({ is_active: e.target.checked })}
                  />
                  Active card
                </label>
                <small className="form-help">
                  Active cards are available to customers. Turn this off to keep
                  the card as a private draft.
                </small>
              </>
            )}
            {tab === "Destinations" && (
              <>
                <h2
                  id="card-links"
                  tabIndex={-1}
                  aria-describedby={
                    fieldErrors.links ? "card-links-error" : undefined
                  }
                >
                  Give every customer a choice
                </h2>
                {fieldErrors.links && (
                  <p id="card-links-error" className="form-error" role="alert">
                    {fieldErrors.links}
                  </p>
                )}
                <p className="section-description">
                  Select destinations and drag to reorder. Every experience is
                  welcome.
                </p>
                <Button
                  onClick={() => setAddingDestination(true)}
                  disabled={workspace.busy || !access.ready}
                >
                  <Plus size={14} /> Add destination
                </Button>
                <p className="form-help">
                  Add a review platform or choose Custom review URL for another
                  destination.
                </p>
                {workspace.links.length ? (
                  workspace.links.map((link) => {
                    const selected = card.links.find(
                      (l) => l.business_review_link_id === link.id,
                    );
                    return (
                      <label className="select-destination" key={link.id}>
                        <Toggle
                          checked={selected?.is_enabled || false}
                          disabled={
                            !access.ready ||
                            !link.is_active ||
                            (!selected?.is_enabled &&
                              access.plan.linksPerCard !== null &&
                              card.links.filter((l) => l.is_enabled).length >=
                                access.plan.linksPerCard)
                          }
                          onChange={(e) =>
                            update({
                              links: selected
                                ? card.links.map((l) =>
                                    l.business_review_link_id === link.id
                                      ? { ...l, is_enabled: e.target.checked }
                                      : l,
                                  )
                                : [
                                    ...card.links,
                                    {
                                      business_review_link_id: link.id,
                                      display_order: card.links.length,
                                      is_enabled: e.target.checked,
                                    },
                                  ],
                            })
                          }
                        />
                        <PlatformIcon id={link.platform_id} small />
                        <span>
                          {link.display_name}
                          <small>
                            {link.is_active
                              ? new URL(link.destination_url).hostname
                              : "Disabled in platform settings"}
                          </small>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="inline-empty">
                    <p>No review destinations yet.</p>
                  </div>
                )}
                <h3 className="field-subheading">Display order</h3>
                <div className="reorder-list">
                  {card.links
                    .filter((l) => l.is_enabled)
                    .map((l) => {
                      const link = workspace.links.find(
                        (saved) => saved.id === l.business_review_link_id,
                      );
                      if (!link) return null;
                      const selectedLinks = card.links.filter(
                        (cl) => cl.is_enabled,
                      );
                      const order = selectedLinks.findIndex(
                        (cl) => cl.business_review_link_id === link.id,
                      );
                      return (
                        <div
                          className="reorder-item"
                          draggable
                          onDragStart={() => setDrag(link.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (drag) reorder(drag, link.id);
                            setDrag(null);
                          }}
                          key={link.id}
                        >
                          <GripVertical size={15} />
                          <PlatformIcon id={link.platform_id} small />
                          <span>{link.display_name}</span>
                          <button
                            aria-label={`Move ${link.display_name} up`}
                            className="icon-button"
                            disabled={order === 0}
                            onClick={() =>
                              reorder(
                                link.id,
                                selectedLinks[order - 1]
                                  .business_review_link_id,
                              )
                            }
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            aria-label={`Move ${link.display_name} down`}
                            className="icon-button"
                            disabled={order === selectedLinks.length - 1}
                            onClick={() =>
                              reorder(
                                link.id,
                                selectedLinks[order + 1]
                                  .business_review_link_id,
                              )
                            }
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      );
                    })}
                </div>
                <p className="form-help">
                  Arrow buttons offer an accessible alternative to dragging.
                </p>
              </>
            )}
            {tab === "Appearance" && (
              <>
                <h2>A familiar face</h2>
                <p className="section-description">
                  Bring your brand to the conversation.
                </p>
                <TemplatePicker
                  value={card.appearance_settings.template || "classic"}
                  onChange={(template) => appearance({ template })}
                />
                <label>
                  Business logo
                  <div className="upload-control">
                    {card.appearance_settings.logo_url && (
                      <img
                        src={card.appearance_settings.logo_url}
                        alt="Current card logo"
                      />
                    )}
                    <span>
                      <Upload size={15} />
                      {uploading ? "Uploading…" : "Choose a logo"}
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        disabled={uploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            appearance({
                              logo_url: await uploadImage(
                                file,
                                workspace.business!.id,
                              ),
                            });
                          } catch (err) {
                            notify(
                              err instanceof Error
                                ? err.message
                                : "Unable to upload.",
                              true,
                            );
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                    </span>
                    {card.appearance_settings.logo_url && (
                      <Button
                        variant="ghost"
                        onClick={() => appearance({ logo_url: "" })}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </label>
                <small className="form-help">
                  PNG, JPG, or JPEG · under 10 MB.
                </small>
                <div className="form-columns">
                  <label>
                    Accent color
                    <div className="color-input">
                      <input
                        type="color"
                        value={card.appearance_settings.accent}
                        onChange={(e) => appearance({ accent: e.target.value })}
                      />
                      <span>{card.appearance_settings.accent}</span>
                    </div>
                  </label>
                  <label>
                    Card background
                    <div className="color-input">
                      <input
                        type="color"
                        value={card.appearance_settings.background}
                        onChange={(e) =>
                          appearance({ background: e.target.value })
                        }
                      />
                      <span>{card.appearance_settings.background}</span>
                    </div>
                  </label>
                </div>
                <div className="form-columns">
                  <label>Title text color<div className="color-input"><input type="color" aria-label="Title text color" value={card.appearance_settings.title_color || "#303846"} onChange={e => appearance({ title_color: e.target.value })} /><span>{card.appearance_settings.title_color || "#303846"}</span></div></label>
                  <label>Paragraph text color<div className="color-input"><input type="color" aria-label="Paragraph text color" value={card.appearance_settings.paragraph_color || "#8c98ab"} onChange={e => appearance({ paragraph_color: e.target.value })} /><span>{card.appearance_settings.paragraph_color || "#8c98ab"}</span></div></label>
                </div>
                <label>Background behind the card<div className="color-input"><input type="color" aria-label="Page background color" value={card.appearance_settings.page_background || "#f3f6fa"} onChange={e => appearance({ page_background: e.target.value })} /><span>{card.appearance_settings.page_background || "#f3f6fa"}</span></div></label>
                <div className="card-background-presets" role="group" aria-label="Page background color presets">
                  <Button onClick={() => appearance({ page_background: "#ffffff" })}>White</Button>
                  <Button onClick={() => appearance({ page_background: "#042751", background_style: "abstract" })}>Revbaze navy</Button>
                </div>
                <label>Page background style<select value={card.appearance_settings.background_style || "abstract"} onChange={e => appearance({ background_style: e.target.value as "solid" | "gradient" | "dots" | "abstract" | "waves" })}><option value="solid">Plain (no pattern)</option><option value="gradient">Soft gradient</option><option value="dots">Subtle dots</option><option value="abstract">Abstract rings & dots</option><option value="waves">Soft waves</option></select></label>
                <div className="form-columns">
                  <label>Card border<select value={card.appearance_settings.border_style || "solid"} onChange={e => appearance({ border_style: e.target.value as "none" | "solid" | "dashed" })}><option value="none">No border</option><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>
                  <label>Border color<div className="color-input"><input type="color" aria-label="Border color" disabled={card.appearance_settings.border_style === "none"} value={card.appearance_settings.border_color || "#e5e9ef"} onChange={e => appearance({ border_color: e.target.value })} /><span>{card.appearance_settings.border_color || "#e5e9ef"}</span></div></label>
                </div>
                <label>
                  Button style
                  <select
                    value={card.appearance_settings.button_style}
                    onChange={(e) =>
                      appearance({
                        button_style: e.target
                          .value as ReviewCard["appearance_settings"]["button_style"],
                      })
                    }
                  >
                    <option value="outline">Outline</option>
                    <option value="filled">Filled</option>
                    <option value="soft">Soft</option>
                  </select>
                </label>
                <label>
                  Corners
                  <select
                    value={card.appearance_settings.radius}
                    onChange={(e) =>
                      appearance({
                        radius: e.target
                          .value as ReviewCard["appearance_settings"]["radius"],
                      })
                    }
                  >
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                    <option value="pill">Pill</option>
                  </select>
                </label>
              </>
            )}
            {tab === "Sharing" && (
              <>
                <h2>One link, wherever you need it</h2>
                <p className="section-description">
                  Your destinations can change. Your card URL can stay the same.
                </p>
                <div className="share-url">
                  <span>{cardUrl(card.slug || "your-card")}</span>
                  <button
                    className="icon-button copy-feedback-button"
                    aria-label={
                      copiedValue === cardUrl(card.slug)
                        ? "Card URL copied"
                        : "Copy card URL"
                    }
                    disabled={!existing || card.slug !== existing.slug}
                    onClick={copy}
                  >
                    {copiedValue === cardUrl(card.slug) ? (
                      <Check size={16} />
                    ) : (
                      <Copy size={16} />
                    )}
                    {copiedValue === cardUrl(card.slug) && <span aria-live="polite">Copied</span>}
                  </button>
                </div>
                <div className="phase-note">
                  {existing && card.is_active
                    ? "Save any changes before sharing this review link or QR code."
                    : "Save and activate your card before sharing it with customers."}
                </div>
                {existing && card.slug === existing.slug && (
                  <QRCustomizer
                    key={existing.id}
                    url={cardQRUrl(existing.slug)}
                    businessId={existing.business_id}
                    businessLogo={existing.appearance_settings.logo_url || workspace.business?.logo_url || ""}
                  />
                )}
                {!existing && (
                  <p className="form-help">
                    Your QR code will be available after creating the card.
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>
        <aside
          className={`editor-preview ${!mobilePreview ? "mobile-hidden" : ""}`}
          style={cardPageBackground(card.appearance_settings)}
        >
          <div className="preview-label">
            <span>
              <Eye size={14} />
              LIVE PREVIEW
            </span>
            <span>Dashboard only</span>
          </div>
          <CardPreview card={card} links={workspace.links} />
          <p className="preview-caption">
            A small invitation to share an honest experience.
          </p>
        </aside>
      </div>
    </>
  );
}
