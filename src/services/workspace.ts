import { validateImage } from "../lib/images";
import { supabase } from "../lib/supabase";
import { emptyWorkspace } from "../types/workspace";
import type {
  Business,
  ReviewCard,
  ReviewLink,
  WorkspaceData,
  CardEvent,
} from "../types/workspace";
import {
  validateColor,
  validateDestination,
  validateSlug,
} from "../lib/validation";
const localKey = "revbaze-link-workspace-v1";
const now = () => new Date().toISOString();
function readLocal(): WorkspaceData {
  const text = localStorage.getItem(localKey);
  return text ? { ...emptyWorkspace(), ...JSON.parse(text) } : emptyWorkspace();
}
function deactivateEmptyCards(data: WorkspaceData) {
  data.cards = data.cards.map((c) => ({
    ...c,
    is_active:
      c.is_active &&
      c.links.some(
        (cl) =>
          cl.is_enabled &&
          data.links.some(
            (l) => l.id === cl.business_review_link_id && l.is_active,
          ),
      ),
  }));
}
function writeLocal(data: WorkspaceData) {
  try {
    localStorage.setItem(localKey, JSON.stringify(data));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError")
      throw new Error(
        "This browser’s workspace storage is full. Use smaller logos or connect Supabase for cloud storage.",
      );
    throw error;
  }
}
function record(data: WorkspaceData, action: string, name: string) {
  if (data.business)
    data.activity.unshift({
      id: crypto.randomUUID(),
      business_id: data.business.id,
      action,
      metadata: { name },
      created_at: now(),
    });
  data.activity = data.activity.slice(0, 100);
}
function assertResult<T>(result: {
  data: T;
  error: { message: string } | null;
}) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function loadEvents(businessId: string): Promise<CardEvent[]> {
  const events: CardEvent[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase!
      .rpc("workspace_visitor_events", { p_business_id: businessId })
      .range(offset, offset + 999);
    const page = assertResult(result) as CardEvent[];
    events.push(...page);
    if (page.length < 1000) {
      if (!events.length) {
        const basic = await supabase!.rpc("free_overview_events", {
          p_business_id: businessId,
        });
        if (basic.error && !["PGRST202", "42883"].includes(basic.error.code))
          assertResult(basic);
        return basic.data || [];
      }
      return events;
    }
  }
}
export async function loadTimezoneEvents(
  businessId: string,
  timeZone: string,
): Promise<CardEvent[]> {
  if (!supabase) return readLocal().events;
  if (timeZone === "Asia/Manila") return loadEvents(businessId);
  const events: CardEvent[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase
      .rpc("workspace_timezone_events", {
        p_business_id: businessId,
        p_timezone: timeZone,
      })
      .range(offset, offset + 999);
    if (result.error && ["PGRST202", "42883"].includes(result.error.code))
      throw new Error(
        "Apply analytics timezone migration 012 to use this timezone.",
      );
    const page = assertResult(result) as CardEvent[];
    events.push(...page);
    if (page.length < 1000) return events;
  }
}
export async function loadWorkspace(
  businessId?: string,
  timeZone = "Asia/Manila",
): Promise<WorkspaceData> {
  if (!supabase) return readLocal();
  let request = supabase
    .from("businesses")
    .select("*")
    .order("created_at")
    .limit(1);
  if (businessId) request = request.eq("id", businessId);
  const businesses = assertResult(await request) as Business[];
  const business = businesses[0];
  if (!business) return emptyWorkspace();
  const [links, cards, events, activity] = await Promise.all([
    supabase
      .from("business_review_links")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at"),
    supabase
      .from("review_cards")
      .select(
        "*, links:review_card_links(business_review_link_id,display_order,is_enabled)",
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    loadTimezoneEvents(business.id, timeZone),
    supabase
      .from("business_activity")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return {
    business,
    links: assertResult(links),
    cards: (assertResult(cards) as ReviewCard[]).map((c) => ({
      ...c,
      links: c.links.sort((a, b) => a.display_order - b.display_order),
    })),
    events,
    activity: assertResult(activity),
  } as WorkspaceData;
}
export async function saveBusiness(business: Business) {
  if (!business.name.trim()) throw new Error("Business name is required.");
  validateSlug(business.slug);
  validateColor(business.brand_color);
  if (business.website_url)
    business.website_url = validateDestination(business.website_url);
  if (supabase) {
    assertResult(await supabase.rpc("save_business", { p_business: business }));
    return;
  }
  const data = readLocal();
  data.business = { ...business, updated_at: now() };
  record(data, "Business profile updated", business.name);
  writeLocal(data);
}
export async function saveLink(link: ReviewLink) {
  link.destination_url = validateDestination(
    link.destination_url,
    link.platform_id,
  );
  if (!link.display_name.trim()) throw new Error("Display name is required.");
  if (supabase) {
    assertResult(await supabase.rpc("save_review_link", { p_link: link }));
    return;
  }
  const data = readLocal();
  if (!data.business || data.business.id !== link.business_id)
    throw new Error("Set up your business first.");
  const existing = data.links.find((l) => l.id === link.id);
  if (!existing && data.links.length >= 1)
    throw new Error(
      "Free allows 1 review platform per business. Upgrade to add another.",
    );
  data.links = [
    ...data.links.filter((l) => l.id !== link.id),
    { ...link, updated_at: now() },
  ];
  deactivateEmptyCards(data);
  record(
    data,
    existing ? "Review platform updated" : "Review platform added",
    link.display_name,
  );
  writeLocal(data);
}
export async function deleteLink(id: string) {
  if (supabase) {
    assertResult(await supabase.rpc("delete_review_link", { p_id: id }));
    return;
  }
  const data = readLocal();
  const link = data.links.find((l) => l.id === id);
  data.links = data.links.filter((l) => l.id !== id);
  data.cards = data.cards.map((c) => ({
    ...c,
    links: c.links.filter((l) => l.business_review_link_id !== id),
  }));
  deactivateEmptyCards(data);
  record(data, "Review platform removed", link?.display_name || "Platform");
  writeLocal(data);
}
export async function saveCard(card: ReviewCard) {
  validateSlug(card.slug);
  validateColor(card.appearance_settings.accent);
  validateColor(card.appearance_settings.background);
  if (card.appearance_settings.title_color) validateColor(card.appearance_settings.title_color);
  if (card.appearance_settings.paragraph_color) validateColor(card.appearance_settings.paragraph_color);
  if (!card.name.trim() || !card.headline.trim())
    throw new Error("Card name and heading are required.");
  if (supabase) {
    assertResult(await supabase.rpc("save_review_card", { p_card: card }));
    return;
  }
  const data = readLocal();
  if (!data.cards.some((c) => c.id === card.id) && data.cards.length >= 1)
    throw new Error(
      "Free allows 1 review card. Upgrade to Growth to add more cards.",
    );
  if (card.links.filter((l) => l.is_enabled).length > 1)
    throw new Error("Free allows 1 enabled platform links per card.");

  if (!data.business || data.business.id !== card.business_id)
    throw new Error("Set up your business first.");
  if (data.cards.some((c) => c.slug === card.slug && c.id !== card.id))
    throw new Error(
      "This card URL is already in use. Choose a different slug.",
    );
  if (
    card.links.some(
      (l) =>
        !data.links.some(
          (saved) =>
            saved.id === l.business_review_link_id &&
            saved.business_id === card.business_id,
        ),
    )
  )
    throw new Error("One or more destinations are no longer available.");
  if (
    card.is_active &&
    !card.links.some(
      (l) =>
        l.is_enabled &&
        data.links.some(
          (saved) => saved.id === l.business_review_link_id && saved.is_active,
        ),
    )
  )
    throw new Error(
      "An active card needs at least one enabled review destination.",
    );
  const exists = data.cards.some((c) => c.id === card.id);
  data.cards = [
    { ...card, updated_at: now() },
    ...data.cards.filter((c) => c.id !== card.id),
  ];
  record(
    data,
    exists ? "Review card updated" : "Review card created",
    card.name,
  );
  writeLocal(data);
}
export async function deleteCard(id: string) {
  if (supabase) {
    assertResult(await supabase.rpc("delete_review_card", { p_id: id }));
    return;
  }
  const data = readLocal();
  const card = data.cards.find((c) => c.id === id);
  data.cards = data.cards.filter((c) => c.id !== id);
  data.events = data.events.filter((e) => e.review_card_id !== id);
  record(data, "Review card deleted", card?.name || "Card");
  writeLocal(data);
}
export async function uploadImage(
  file: File,
  businessId?: string,
): Promise<string> {
  validateImage(file);
  if (!supabase)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Choose a valid image file."));
        image.onload = () => {
          const scale = Math.min(1, 512 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas
            .getContext("2d")!
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", 0.9));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  if (!businessId)
    throw new Error(
      "Save your business information before uploading its logo.",
    );
  const extension = file.type.split("/")[1];
  const path = `${businessId}/${crypto.randomUUID()}.${extension}`;
  assertResult(
    await supabase.storage
      .from("business-assets")
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  return supabase.storage.from("business-assets").getPublicUrl(path).data
    .publicUrl;
}

export async function uploadAccountImage(file: File): Promise<string> {
  if (!supabase) return uploadImage(file);
  validateImage(file);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user)
    throw new Error("Sign in before uploading a profile image.");
  const path = `${data.user.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
  assertResult(
    await supabase.storage
      .from("profile-assets")
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  return supabase.storage.from("profile-assets").getPublicUrl(path).data
    .publicUrl;
}
