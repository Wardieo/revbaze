import { useCopyFeedback } from "../../hooks/useCopyFeedback";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { QRCustomizer } from "../../components/onboarding/QRCustomizer";
import { useFeedback } from "../../hooks/useFeedback";
import { publishedCardUrl } from "./model";
import type { OnboardingData } from "./model";
export function PublishStep({
  data,
  finish,
  busy,
}: {
  data: OnboardingData;
  finish: () => void;
  busy: boolean;
}) {
  const reduced = useReducedMotion();
  const notify = useFeedback();
  const { copiedValue, markCopied } = useCopyFeedback();
  const url = publishedCardUrl(data.card.slug);
  return (
    <div>
      <div className="onboard-success">
        <motion.span
          initial={reduced ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="onboard-success-mark"
        >
          <Check size={30} />
        </motion.span>
        {!reduced &&
          Array.from({ length: 9 }, (_, i) => (
            <motion.i
              key={i}
              className="onboard-confetti"
              style={{ background: ["#042751", "#67b096", "#8aa6c3"][i % 3] }}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{
                x: Math.cos(i * 2.4) * 95,
                y: Math.sin(i * 2.4) * 65,
                opacity: [0, 0.8, 0],
                rotate: i * 40,
              }}
              transition={{ duration: 0.4, delay: 0.04 * i }}
            />
          ))}
        <p>Your business and first review card are saved and published.</p>
      </div>
      <div className="onboard-customize">
        <div>
          <div className="onboard-published-link">
            <label>
              Your public review card URL
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
            </label>
            <div className="onboard-share-actions">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    markCopied(url);
                    notify("Review link copied.");
                  } catch {
                    notify(
                      "Could not copy. Select the URL and copy it manually.",
                      true,
                    );
                  }
                }}
              >
                {copiedValue === url ? <Check size={14} /> : <Copy size={14} />}
                <span aria-live="polite">
                  {copiedValue === url ? "Copied" : "Copy Link"}
                </span>
              </Button>
              <Button asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Open Review Card
                  <ExternalLink size={14} />
                </a>
              </Button>
            </div>
          </div>
          <QRCustomizer
            url={`${url}${url.includes("?") ? "&" : "?"}utm_source=qr`}
            businessId={data.business.id}
            businessLogo={data.business.logo_url}
          />
          <Button
            variant="primary"
            className="onboard-finish"
            disabled={busy}
            onClick={finish}
          >
            {busy ? "Opening dashboard…" : "Go to Dashboard"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
