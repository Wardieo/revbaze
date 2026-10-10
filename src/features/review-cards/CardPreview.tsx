import { BrandLogo } from "../../components/shared/BrandLogo";
import { readableText } from "../../lib/colors";
import { ArrowUpRight, Heart, LockKeyhole } from "lucide-react";
import type { ReviewCard, ReviewLink } from "../../types/workspace";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
export function CardPreview({
  card,
  links,
  interactive = false,
  onDestinationClick,
}: {
  card: ReviewCard;
  links: ReviewLink[];
  interactive?: boolean;
  onDestinationClick?: (linkId: string) => void;
}) {
  const Destination = interactive ? "a" : "div";
  const appearance = card.appearance_settings;
  const destinations = card.links
    .filter((c) => c.is_enabled)
    .sort((a, b) => a.display_order - b.display_order)
    .flatMap((c) => {
      const l = links.find(
        (l) => l.id === c.business_review_link_id && l.is_active,
      );
      return l ? [l] : [];
    });
  return (
    <div className={interactive ? "review-card-public-container" : "review-card-backdrop"}>
    <div
      className={`preview-card template-${appearance.template || "classic"}`}
      style={{
        backgroundColor: appearance.background,
        border: appearance.border_style === "none" ? "none" : `1px ${appearance.border_style || "solid"} ${appearance.border_color || "#e5e9ef"}`,
        color: readableText(appearance.background),
        borderRadius:
          appearance.radius === "square"
            ? 4
            : appearance.radius === "pill"
              ? 24
              : 14,
      }}
    >
      <div className="preview-identity">
        <div
          className="preview-business-mark"
          style={{
            background: `${appearance.accent}15`,
            color: appearance.accent,
          }}
        >
          {appearance.logo_url ? (
            <img src={appearance.logo_url} alt="Business logo" />
          ) : (
            appearance.business_name.charAt(0) || <Heart size={23} />
          )}
        </div>
        <div className="preview-business-name" style={{ color: appearance.paragraph_color || undefined }}>
          {appearance.business_name || "Your business"}
        </div>
      </div>
      <h2 style={{ color: appearance.title_color || undefined }}>{card.headline || "Your experience matters."}</h2>
      <p style={{ color: appearance.paragraph_color || undefined }}>
        {card.description ||
          "Choose your favorite platform and share your experience with us."}
      </p>
      <div className="preview-destinations">
        {destinations.map((l) => (
          <Destination
            onClick={interactive ? () => onDestinationClick?.(l.id) : undefined}
            onAuxClick={
              interactive
                ? (event) => {
                    if (event.button === 1) onDestinationClick?.(l.id);
                  }
                : undefined
            }
            href={interactive ? l.destination_url : undefined}
            target={interactive ? "_blank" : undefined}
            rel={interactive ? "noopener noreferrer" : undefined}
            className={`preview-destination style-${appearance.button_style}`}
            key={l.id}
            style={{
              borderRadius:
                appearance.radius === "square"
                  ? 3
                  : appearance.radius === "pill"
                    ? 30
                    : 8,
              borderColor:
                appearance.button_style === "outline"
                  ? appearance.accent
                  : appearance.button_style === "filled"
                    ? appearance.accent
                    : `${appearance.accent}20`,
              background:
                appearance.button_style === "filled"
                  ? appearance.accent
                  : appearance.button_style === "soft"
                    ? `${appearance.accent}12`
                    : "transparent",
              color:
                appearance.button_style === "filled"
                  ? readableText(appearance.accent)
                  : readableText(appearance.background),
            }}
          >
            <PlatformIcon id={l.platform_id} small />
            <span>
              {l.display_name}
              {l.platform_id === "custom" && (
                <small className="preview-destination-domain">
                  {new URL(l.destination_url).hostname}
                </small>
              )}
            </span>
            <ArrowUpRight size={15} />
          </Destination>
        ))}
        {!destinations.length && (
          <div className="preview-no-links">
            Select a destination to see it here.
          </div>
        )}
      </div>
      <div className="preview-neutral" style={{ color: appearance.paragraph_color || undefined }}>
        <Heart size={11} />
        Every experience is welcome.
      </div>
      <div className="preview-powered" style={{ color: appearance.paragraph_color || undefined }}>
        Made with{" "}
        <strong>
          <BrandLogo />
        </strong>
      </div>
      {!interactive && (
        <span className="preview-only">
          <LockKeyhole size={10} />
          Dashboard preview · buttons do not navigate
        </span>
      )}
    </div>
    </div>
  );
}
