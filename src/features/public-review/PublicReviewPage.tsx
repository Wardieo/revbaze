import "./public-review.css";
import { useEffect, useRef } from "react";
import { recordReviewEvent } from "../../services/reviewEvents";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { CardPreview } from "../review-cards/CardPreview";
import { cardPageBackground } from "../review-cards/cardPageBackground";
import { Skeleton } from "../../components/shared/Feedback";
import type { ReviewCard, ReviewLink } from "../../types/workspace";
export function PublicReviewPage() {
  const { slug = "" } = useParams();
  const query = useQuery({
    queryKey: ["published-card", slug],
    queryFn: async () => {
      if (!supabase) throw new Error("This review card is unavailable.");
      const { data, error } = await supabase.rpc("published_review_card", {
        p_slug: slug,
      });
      if (error)
        throw new Error("Unable to load this review card. Please try again.");
      return data as (ReviewCard & { destinations: ReviewLink[] }) | null;
    },
    retry: 1,
    refetchInterval: 30000,
  });
  const card = query.data;
  const tracked = useRef("");
  useEffect(() => {
    if (card && tracked.current !== card.id) {
      tracked.current = card.id;
      void recordReviewEvent(slug, "page_view");
    }
  }, [card, slug]);
  return (
    <div className="app public-review-shell" style={card ? cardPageBackground(card.appearance_settings) : undefined}>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <section className="card error-state">
          <h1>We couldn’t load this invitation</h1>
          <p>{query.error.message}</p>
          <button onClick={() => void query.refetch()}>Try again</button>
        </section>
      ) : !card ? (
        <section className="card error-state">
          <h1>This review page is currently unavailable</h1>
          <p>
            It may have been unpublished or deactivated. Please contact the
            business for a new link.
          </p>
        </section>
      ) : (
        <CardPreview
          card={{
            ...card,
            links: card.destinations.map((l, i) => ({
              business_review_link_id: l.id,
              display_order: i,
              is_enabled: true,
            })),
          }}
          links={card.destinations.map((l) => ({ ...l, is_active: true }))}
          onDestinationClick={(linkId) =>
            void recordReviewEvent(slug, "outbound_click", linkId)
          }
          interactive
        />
      )}
    </div>
  );
}
