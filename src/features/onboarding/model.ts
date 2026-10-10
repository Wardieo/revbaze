import type {
  Business,
  CardAppearance,
  ReviewCard,
  ReviewLink,
} from "../../types/workspace";
import {
  validateDestination,
  validateSlug,
  slugify,
  validateColor,
  cardUrl,
} from "../../lib/validation";
export type OnboardingData = {
  name: string;
  avatar: string;
  business: Business;
  links: ReviewLink[];
  card: {
    template: NonNullable<CardAppearance["template"]>;
    slug: string;
    headline: string;
    description: string;
    accent: string;
    background: string;
    page_background: string;
    background_style: "solid" | "gradient" | "dots" | "abstract" | "waves";
    border_style: "none" | "solid" | "dashed";
    border_color: string;
    button_style: CardAppearance["button_style"];
    radius: CardAppearance["radius"];
  };
};
export type DraftRow = {
  id: string;
  business_id: string;
  card_id: string;
  draft: Partial<OnboardingData>;
  step: number;
  revision: number;
  completed_at: string | null;
};
export type OnboardingStatus = {
  businesses: {
    id: string;
    name: string;
    logo_url?: string;
    complete: boolean;
    owner: boolean;
  }[];
  draft: DraftRow | null;
};
export function initialData(
  row: DraftRow,
  name: string,
  email: string,
  avatar: string,
): OnboardingData {
  const saved = row.draft;
  const date = new Date().toISOString();
  const business = {
    id: row.business_id,
    name: "",
    category: "",
    description: "",
    logo_url: "",
    website_url: "",
    contact_email: email,
    brand_color: "#042751",
    slug: "workspace-" + row.business_id.replaceAll("-", ""),
    created_at: date,
    updated_at: date,
    ...saved.business,
  };
  return {
    name: saved.name ?? name,
    avatar: saved.avatar ?? avatar,
    business,
    links: saved.links ?? [],
    card: {
      template: "classic",
      slug: slugify(business.name),
      headline: "Your experience matters.",
      description:
        "Choose your favorite platform and share your experience with us.",
      accent: business.brand_color,
      background: "#ffffff",
      page_background: "#f3f6fa",
      background_style: "abstract",
      border_style: "solid",
      border_color: "#e5e9ef",
      button_style: "soft",
      radius: "rounded",
      ...saved.card,
    },
  };
}
export function stepError(data: OnboardingData, step: number) {
  try {
    if (step === 1 && !data.name.trim()) return "Enter your full name.";
    if (step >= 2) {
      if (!data.business.name.trim()) return "Enter your business name.";
      if (!data.business.category.trim()) return "Choose a business category.";
      if (data.business.website_url)
        validateDestination(data.business.website_url);
    }
    if (step >= 3) {
      if (!data.links.length) return "Add at least one review platform.";
      for (const l of data.links) {
        if (!l.display_name.trim()) return "Give your custom platform a name.";
        validateDestination(l.destination_url, l.platform_id);
      }
    }
    if (step >= 4) {
      validateSlug(data.card.slug);
      validateColor(data.card.accent);
      validateColor(data.card.background);
      validateColor(data.card.page_background || "#f3f6fa");
      validateColor(data.card.border_color);
      if (!data.card.headline.trim()) return "Enter a review card heading.";
    }
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "Check the fields above.";
  }
}
export function draftPreview(row: DraftRow, data: OnboardingData): ReviewCard {
  return {
    id: row.card_id,
    business_id: row.business_id,
    name: data.business.name + " review card",
    slug: data.card.slug,
    headline: data.card.headline,
    description: data.card.description,
    appearance_settings: {
      template: data.card.template,
      business_name: data.business.name,
      logo_url: data.business.logo_url,
      accent: data.card.accent,
      background: data.card.background,
      page_background: data.card.page_background || "#f3f6fa",
      background_style: data.card.background_style,
      border_style: data.card.border_style,
      border_color: data.card.border_color,
      button_style: data.card.button_style,
      radius: data.card.radius,
    },
    is_active: true,
    created_at: "",
    updated_at: "",
    links: data.links.map((l, i) => ({
      business_review_link_id: l.id,
      display_order: i,
      is_enabled: true,
    })),
  };
}
export function publishedCardUrl(slug: string) {
  return cardUrl(slug);
}
