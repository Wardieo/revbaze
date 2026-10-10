import { supabase } from "../lib/supabase";
import type {
  DraftRow,
  OnboardingData,
  OnboardingStatus,
} from "../features/onboarding/model";
function client() {
  if (!supabase)
    throw new Error(
      "Configure Supabase and apply the database migrations to save and publish your review card.",
    );
  return supabase;
}
async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function loadOnboardingStatus() {
  const status = await rpc<OnboardingStatus>("onboarding_status");
  if (!status.businesses.length) return status;
  const { data, error } = await client()
    .from("businesses")
    .select("id,logo_url")
    .in(
      "id",
      status.businesses.map((b) => b.id),
    );
  if (error) return status;
  return {
    ...status,
    businesses: status.businesses.map((b) => ({
      ...b,
      logo_url: data?.find((asset) => asset.id === b.id)?.logo_url || "",
    })),
  };
}
export const beginOnboarding = (newBusiness = false) =>
  rpc<DraftRow>("begin_onboarding", { p_new_business: newBusiness });
export const saveOnboarding = (
  row: DraftRow,
  data: OnboardingData,
  step: number,
) =>
  rpc<DraftRow>("save_onboarding_draft", {
    p_id: row.id,
    p_draft: data,
    p_step: Math.min(step, 4),
    p_revision: row.revision,
  });
export const slugAvailable = (slug: string, cardId: string) =>
  rpc<boolean>("check_onboarding_slug", { p_slug: slug, p_card_id: cardId });
export const publishOnboarding = (row: DraftRow) =>
  rpc<{ draft: DraftRow }>("publish_onboarding", {
    p_id: row.id,
    p_revision: row.revision,
  });
