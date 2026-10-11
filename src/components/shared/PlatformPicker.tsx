import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { getRecommendedPlatforms, platforms } from "../../lib/platforms";
import { PlatformIcon } from "./PlatformIcon";
import "./platform-picker.css";

export function PlatformPicker({
  category,
  selected,
  onSelect,
  isDisabled = () => false,
  multiple = false,
  added = [],
}: {
  category: string;
  selected: readonly string[];
  onSelect: (id: string) => void;
  isDisabled?: (id: string) => boolean;
  multiple?: boolean;
  added?: readonly string[];
}) {
  const [showAll, setShowAll] = useState(false);
  const recommended = getRecommendedPlatforms(category);
  const recommendedIds = new Set(recommended.map((p) => p.id));
  const other = platforms.filter(
    (p) => !recommendedIds.has(p.id) && p.id !== "custom",
  );
  const tiles = (items: readonly (typeof platforms)[number][]) => (
    <div className="review-platform-grid">
      {items.map((p) => {
        const checked = selected.includes(p.id);
        const exists = added.includes(p.id);
        return (
          <motion.button
            key={p.id}
            type="button"
            disabled={isDisabled(p.id)}
            aria-pressed={checked}
            title={exists ? "Already added" : undefined}
            onClick={() => onSelect(p.id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={checked ? "selected" : ""}
          >
            <PlatformIcon id={p.id} />
            <span>
              {p.id === "app-store" ? "Apple App Store" : p.name}
              {exists && (
                <small className="review-platform-added">Already added</small>
              )}
            </span>
            {checked || exists ? <Check size={14} /> : <Plus size={14} />}
          </motion.button>
        );
      })}
    </div>
  );
  return (
    <div className="review-platform-picker">
      <div className="review-platform-picker-heading">
        <strong>Recommended platforms</strong>
        <p aria-live="polite">
          {category
            ? `Suggested for ${category}.`
            : "Popular destinations for your business."}{" "}
          {multiple
            ? "Select your platforms below."
            : "Choose a platform below."}
        </p>
      </div>
      {tiles(recommended)}
      <button
        type="button"
        className="review-platform-more"
        aria-expanded={showAll}
        onClick={() => setShowAll(!showAll)}
      >
        {showAll ? "Hide other platforms" : "Browse other platforms"}
      </button>
      {(showAll || other.some((p) => selected.includes(p.id))) &&
        tiles(showAll ? other : other.filter((p) => selected.includes(p.id)))}
      {tiles(platforms.filter((p) => p.id === "custom"))}
      <small className="review-platform-picker-help">
        Use your business profile, shop, product, or review page URL.
        Availability and review eligibility vary by platform.
      </small>
    </div>
  );
}
