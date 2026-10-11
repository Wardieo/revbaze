import { useEffect, useState } from "react";
import { TemplatePicker } from "../../components/onboarding/TemplatePicker";
import { ImageUpload } from "../../components/onboarding/ImageUpload";
import { uploadImage } from "../../services/workspace";
import { PlatformOrder } from "./PlatformsStep";
import { usePublicSlug } from "../../hooks/usePublicSlug";
import { SlugStatus } from "../../components/shared/SlugStatus";
import { slugify, validateSlug } from "../../lib/validation";
import type { DraftRow, OnboardingData } from "./model";
export function CustomizeStep({
  data,
  row,
  update,
  onSlugState,
}: {
  data: OnboardingData;
  row: DraftRow;
  update: (data: OnboardingData) => void;
  onSlugState: (state: string) => void;
}) {
  const [automaticSlug, setAutomaticSlug] = useState(
    !data.card.slug || data.card.slug === slugify(data.business.name),
  );
  const { message, available } = usePublicSlug({
    slug: data.card.slug,
    cardId: row.card_id,
    automatic: automaticSlug,
    name: data.business.name,
    onGenerated: (slug) => update({ ...data, card: { ...data.card, slug } }),
  });
  useEffect(() => onSlugState(message), [message, onSlugState]);
  const field = (key: string, value: string) =>
    update({ ...data, card: { ...data.card, [key]: value } });
  let format = "";
  try {
    validateSlug(data.card.slug);
  } catch (err) {
    format = (err as Error).message;
  }
  return (
    <div className="onboard-customize">
      <div className="stack-form">
        <TemplatePicker
          value={data.card.template}
          onChange={(template) =>
            update({ ...data, card: { ...data.card, template } })
          }
        />
        <label>
          Public URL slug <span className="onboard-required">Required</span>
          <div className="onboard-slug">
            <span>revbaze.com/</span>
            <input
              required
              maxLength={60}
              value={data.card.slug}
              aria-describedby="onboard-slug-help"
              aria-invalid={Boolean(format)}
              onChange={(e) => {
                setAutomaticSlug(false);
                field("slug", e.target.value);
              }}
            />
            <SlugStatus available={available} message={message} />
          </div>
          <small
            id="onboard-slug-help"
            aria-live="polite"
            className={
              message && message !== "Checking availability…"
                ? "onboard-inline-error"
                : "onboard-help"
            }
          >
            {message || "Available · reserved when you publish."}
          </small>
        </label>
        <label>
          Review card heading
          <input
            required
            maxLength={120}
            value={data.card.headline}
            onChange={(e) => field("headline", e.target.value)}
          />
        </label>
        <label>
          Short description <span className="onboard-required">Optional</span>
          <textarea
            maxLength={500}
            rows={3}
            value={data.card.description}
            onChange={(e) => field("description", e.target.value)}
          />
        </label>
        <ImageUpload
          label="Business logo"
          value={data.business.logo_url}
          upload={(file) => uploadImage(file, row.business_id)}
          onChange={(logo_url) =>
            update({ ...data, business: { ...data.business, logo_url } })
          }
        />
        <label>
          Brand accent color
          <div className="onboard-color">
            <input
              type="color"
              aria-label="Brand accent color"
              value={data.card.accent}
              onChange={(e) => field("accent", e.target.value)}
            />
            <span>{data.card.accent}</span>
          </div>
        </label>
        <label>
          Card background color
          <div className="onboard-color">
            <input
              type="color"
              aria-label="Card background color"
              value={data.card.background}
              onChange={(e) => field("background", e.target.value)}
            />
            <span>{data.card.background}</span>
          </div>
        </label>
        <fieldset className="onboard-page-background">
          <legend>Background behind your card</legend>
          <p className="onboard-help">
            Customize the full page around your card. Your card’s own color
            stays separate.
          </p>
          <label>
            Background behind the card
            <div className="onboard-color">
              <input
                type="color"
                aria-label="Page background color"
                value={data.card.page_background || "#f3f6fa"}
                onChange={(e) => field("page_background", e.target.value)}
              />
              <span>{data.card.page_background || "#f3f6fa"}</span>
            </div>
          </label>
          <div
            className="card-background-presets"
            role="group"
            aria-label="Page background color presets"
          >
            <button
              type="button"
              className="button"
              onClick={() => field("page_background", "#ffffff")}
            >
              White
            </button>
            <button
              type="button"
              className="button"
              onClick={() =>
                update({
                  ...data,
                  card: {
                    ...data.card,
                    page_background: "#042751",
                    background_style: "abstract",
                  },
                })
              }
            >
              Revbaze navy
            </button>
          </div>
          <label>
            Page background style
            <select
              value={data.card.background_style || "abstract"}
              onChange={(e) => field("background_style", e.target.value)}
            >
              <option value="solid">Plain (no pattern)</option>
              <option value="gradient">Soft gradient</option>
              <option value="dots">Subtle dots</option>
              <option value="abstract">Abstract rings & dots</option>
              <option value="waves">Soft waves</option>
            </select>
          </label>
        </fieldset>
        <label>
          Card border
          <select
            value={data.card.border_style}
            onChange={(e) => field("border_style", e.target.value)}
          >
            <option value="none">No border</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </label>
        <label>
          Border color
          <div className="onboard-color">
            <input
              type="color"
              aria-label="Card border color"
              disabled={data.card.border_style === "none"}
              value={data.card.border_color}
              onChange={(e) => field("border_color", e.target.value)}
            />
            <span>{data.card.border_color}</span>
          </div>
        </label>
        <label>
          Button appearance
          <select
            value={data.card.button_style}
            onChange={(e) => field("button_style", e.target.value)}
          >
            <option value="soft">Soft tint</option>
            <option value="filled">Filled</option>
            <option value="outline">Outline</option>
          </select>
        </label>
        <label>
          Button corners
          <select
            value={data.card.radius}
            onChange={(e) => field("radius", e.target.value)}
          >
            <option value="rounded">Rounded</option>
            <option value="pill">Pill</option>
            <option value="square">Square</option>
          </select>
        </label>
        <label>Platform order</label>
        <PlatformOrder
          links={data.links}
          onChange={(links) => update({ ...data, links })}
          editable={false}
        />
      </div>
    </div>
  );
}
