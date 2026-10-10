import { useEffect, useRef, useState } from "react";
import { useFeedback } from "../../hooks/useFeedback";
import { Link, useSearchParams } from "react-router-dom";
import {
  QrCode,
  Copy,
  Plus,
  ExternalLink,
  ArrowRight,
  Check,
  Palette,
  Download,
  Info,
} from "lucide-react";
import { useWorkspace } from "../../stores/workspace";
import { EmptyState } from "../../components/shared/Feedback";
import { Button } from "../../components/ui/Button";
import { cardQRUrl } from "../../lib/validation";
import "./qr-studio.css";
import { QRCustomizer } from "../../components/onboarding/QRCustomizer";
export function QRCodesPage() {
  const { cards, business } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const selected = params.get("card") || cards[0]?.id || "";
  const setSelected = (id: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("card", id);
      return next;
    });
  const card = cards.find((c) => c.id === selected) || cards[0];
  const notify = useFeedback();
  const [copiedUrl, setCopiedUrl] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [source, setSource] = useState("qr");
  const destination = card
    ? cardQRUrl(card.slug, source)
    : "";
  const copied = Boolean(destination) && copiedUrl === destination;
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  return (
    <div className="qr-studio">
      <div className="qr-studio-header">
        <Button asChild>
          <Link to="/cards">
            Manage review cards
            <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
      {card ? (
        <>
          <section className="card qr-studio-destination">
            <div className="qr-studio-destination-heading">
              <span className="qr-studio-icon">
                <QrCode size={22} />
              </span>
              <div>
                <h2>Choose your destination</h2>
                <p>Every scan opens the selected review card.</p>
              </div>
              <span
                className={`status-badge ${card.is_active ? "active" : "inactive"}`}
              >
                {card.is_active ? "Active card" : "Inactive card"}
              </span>
            </div>
            <div className="stack-form qr-studio-link-fields">
              <label>
                Review card
                <select
                  value={card.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {!c.is_active ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tracking source
                <input
                  value={source}
                  maxLength={80}
                  pattern="[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,79}"
                  onChange={(e) => {
                    if (
                      !e.target.value ||
                      /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,79}$/.test(e.target.value)
                    )
                      setSource(e.target.value);
                  }}
                  placeholder="qr, counter, receipts, email"
                />
                <small>
                  Use qr for QR scans, or name a placement such as counter or
                  receipts. New downloads include this tag; previously printed
                  codes stay unchanged.
                </small>
              </label>
              <label>
                Review card destination
                <div className="share-url">
                  <span>{destination}</span>
                  <button
                    className={`qr-studio-copy${copied ? " copied" : ""}`}
                    aria-label={
                      copied ? "QR destination copied" : "Copy QR destination"
                    }
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(destination);
                        if (copyTimer.current) clearTimeout(copyTimer.current);
                        setCopiedUrl(destination);
                        copyTimer.current = setTimeout(
                          () => setCopiedUrl(""),
                          2500,
                        );
                        notify("QR destination copied.");
                      } catch {
                        notify("Unable to copy destination.", true);
                      }
                    }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </label>
            </div>
            {!card.is_active && (
              <p className="qr-studio-notice">
                <Info size={16} />
                This card is inactive. Activate it in Review Cards before
                sharing or printing its QR code.
                <Link to={`/cards/${card.id}/edit`}>
                  Edit card
                  <ArrowRight size={13} />
                </Link>
              </p>
            )}
            {card.is_active && (
              <a
                className="text-link qr-studio-test"
                href={destination}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open review page
                <ExternalLink size={13} />
              </a>
            )}
          </section>
          <section className="card qr-studio-design">
            <div className="qr-studio-design-heading">
              <span className="qr-studio-icon">
                <Palette size={20} />
              </span>
              <div>
                <h2>Design & download</h2>
                <p>Personalize the details. Your preview updates as you go.</p>
              </div>
              <span className="qr-studio-live">
                <span />
                Live preview
              </span>
            </div>
            <QRCustomizer
              key={card.id}
              url={destination}
              businessId={card.business_id}
              businessLogo={
                card.appearance_settings.logo_url || business?.logo_url || ""
              }
              layout="split"
            />
            <div className="qr-studio-bottom-note">
              <Check size={15} />
              <span>
                Your design is saved in this browser. Keep the review card URL
                unchanged after printing.
              </span>
            </div>
          </section>
          <div className="qr-studio-tips">
            <div>
              <Download size={18} />
              <strong>Choose your format</strong>
              <p>PNG for digital sharing. SVG for crisp print at any size.</p>
            </div>
            <div>
              <QrCode size={18} />
              <strong>Scan before printing</strong>
              <p>
                Test on your phone, especially after changing colors or adding a
                logo.
              </p>
            </div>
            <div>
              <Palette size={18} />
              <strong>Make it recognizable</strong>
              <p>
                Use your brand colors with a dark code and light background.
              </p>
            </div>
          </div>
        </>
      ) : (
        <section className="card">
          <EmptyState
            icon={<QrCode size={30} />}
            title="A QR code for every invitation"
            description="Create a review card first. Then download its QR code for receipts, packaging, or your counter."
          >
            <Button variant="primary" asChild>
              <Link to={business ? "/cards/new" : "/onboarding"}>
                <Plus size={15} />
                Create review card
              </Link>
            </Button>
          </EmptyState>
        </section>
      )}
    </div>
  );
}
