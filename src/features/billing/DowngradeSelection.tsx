import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDowngradeAccess } from "../../hooks/useDowngradeAccess";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
export function DowngradeSelection() {
  const access = useDowngradeAccess();
  const cache = useQueryClient();
  const [business, setBusiness] = useState("");
  const [card, setCard] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const data = access.data;
  if (access.isError)
    return (
      <div className="billing-error" role="alert">
        {access.error.message}
        <Button onClick={() => void access.refetch()}>Retry</Button>
      </div>
    );
  if (
    !data ||
    (!data.businesses.some((b) => !b.available) &&
      !data.cards.some((c) => !c.available) &&
      !(data.plan === "free" && data.links.some((l) => !l.available)))
  )
    return null;
  const selectedBusiness =
    business ||
    data.businesses.find((b) => b.available)?.id ||
    data.businesses[0]?.id ||
    "";
  const cards = data.cards.filter((c) => c.business_id === selectedBusiness);
  const selectedCard = cards.some((c) => c.id === card)
    ? card
    : cards.find((c) => c.available)?.id || cards[0]?.id || "";
  const links = data.links.filter((l) => l.card_id === selectedCard);
  const selectedLink = links.some((l) => l.id === link)
    ? link
    : links.find((l) => l.available)?.id || links[0]?.id || "";
  return (
    <section className="downgrade-selection">
      <span className="billing-eyebrow">YOUR SAVED WORK IS SAFE</span>
      <h3>Choose what stays available</h3>
      <p>
        Items above your plan limits are paused, not deleted. Their public pages
        are unavailable. Upgrade to restore eligible items with the same links
        and settings.
      </p>
      {data.plan === "free" && (
        <>
          <div className="downgrade-fields">
            <label>
              Business
              <select
                value={selectedBusiness}
                onChange={(e) => {
                  setBusiness(e.target.value);
                  setCard("");
                  setLink("");
                }}
              >
                {data.businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review card
              <select
                value={selectedCard}
                onChange={(e) => {
                  setCard(e.target.value);
                  setLink("");
                }}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review platform
              <select
                value={selectedLink}
                onChange={(e) => setLink(e.target.value)}
              >
                {links.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            Selecting an inactive card keeps it inactive. Only an enabled
            destination can be selected.
          </p>
          <Button
            disabled={busy || !selectedLink}
            variant="primary"
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                const { error } = await supabase!.rpc(
                  "select_free_plan_items",
                  {
                    p_business: selectedBusiness,
                    p_card: selectedCard,
                    p_link: selectedLink,
                  },
                );
                if (error) throw error;
                await Promise.all([
                  cache.invalidateQueries({ queryKey: ["downgrade-access"] }),
                  cache.invalidateQueries({ queryKey: ["workspace"] }),
                  cache.invalidateQueries({ queryKey: ["account-plan"] }),
                ]);
                setMessage("Your Free selection is saved.");
              } catch (e) {
                setMessage(
                  e instanceof Error
                    ? e.message
                    : "Unable to save your selection.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save Free selection"}
          </Button>
        </>
      )}
      <Link className="button button-outline" to="/upgrade">
        Restore with a paid plan
      </Link>
      {message && <p role="status">{message}</p>}
      <ul className="downgrade-saved-list">
        {data.businesses.map((b) => (
          <li key={b.id}>
            <span>{b.name}</span>
            <span
              className={`status-badge ${b.available ? "active" : "inactive"}`}
            >
              {b.available ? "Available" : "Paused · plan limit"}
            </span>
          </li>
        ))}
        {data.cards.map((c) => (
          <li key={c.id}>
            <span>{c.name}</span>
            <span
              className={`status-badge ${c.available ? "active" : "inactive"}`}
            >
              {!c.available
                ? "Paused · plan limit"
                : c.active
                  ? "Available"
                  : "Inactive"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
