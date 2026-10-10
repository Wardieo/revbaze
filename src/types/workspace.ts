export type Theme = "light" | "dark" | "system";
export type Business = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  website_url: string;
  category: string;
  contact_email: string;
  brand_color: string;
  created_at: string;
  updated_at: string;
};
export type ReviewLink = {
  id: string;
  business_id: string;
  platform_id: string;
  display_name: string;
  destination_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type CardTemplate = "classic" | "left" | "split" | "grid";
export type CardAppearance = {
  template?: CardTemplate;
  business_name: string;
  logo_url: string;
  accent: string;
  background: string;
  page_background?: string;
  background_style?: "solid" | "gradient" | "dots" | "abstract" | "waves";
  border_style?: "none" | "solid" | "dashed";
  border_color?: string;
  title_color?: string;
  paragraph_color?: string;
  button_style: "filled" | "outline" | "soft";
  radius: "square" | "rounded" | "pill";
};
export type CardLink = {
  business_review_link_id: string;
  display_order: number;
  is_enabled: boolean;
};
export type ReviewCard = {
  published_at?: string | null;
  id: string;
  business_id: string;
  name: string;
  slug: string;
  headline: string;
  description: string;
  appearance_settings: CardAppearance;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  links: CardLink[];
};
export type CardEvent = {
  platform_id?: string | null;
  visitor_key?: string | null;
  traffic_source?: string | null;
  count?: number;
  id: string;
  review_card_id: string;
  event_type: "page_view" | "outbound_click";
  business_review_link_id: string | null;
  referrer: string | null;
  created_at: string;
};
export type Activity = {
  id: string;
  business_id: string;
  action: string;
  metadata: Record<string, string>;
  created_at: string;
};
export type WorkspaceData = {
  business: Business | null;
  links: ReviewLink[];
  cards: ReviewCard[];
  events: CardEvent[];
  activity: Activity[];
};
export const emptyWorkspace = (): WorkspaceData => ({
  business: null,
  links: [],
  cards: [],
  events: [],
  activity: [],
});
