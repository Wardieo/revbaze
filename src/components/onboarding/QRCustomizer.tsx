import { usePlan } from "../../hooks/usePlan";
import { Link } from "react-router-dom";
import { Toggle } from "../ui/Toggle";
import "./QRCustomizer.css";
import { useEffect, useState } from "react";
import { ImageUpload } from "./ImageUpload";
import { uploadImage } from "../../services/workspace";
import { QRPreview } from "../../features/qr-codes/QRPreview";
import type { QRStyle } from "../../lib/qr";
type Settings = {
  style: QRStyle;
  foreground: string;
  background: string;
  logo: string;
  includeLogo: boolean;
};
export function QRCustomizer({
  url,
  businessId,
  businessLogo,
  layout = "stack",
}: {
  url: string;
  businessId: string;
  businessLogo: string;
  layout?: "stack" | "split";
}) {
  const access = usePlan(businessId);
  const custom = access.ready && access.plan.customQR;
  const storageKey = `revbaze-qr-design:${businessId}:${url}`;
  const [settings, setSettings] = useState<Settings>(() => {
    const defaults: Settings = {
      style: "square",
      foreground: "#253147",
      background: "#ffffff",
      logo: businessLogo,
      includeLogo: Boolean(businessLogo),
    };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        saved &&
        ["square", "rounded", "dots"].includes(saved.style) &&
        /^#[0-9a-f]{6}$/i.test(saved.foreground) &&
        /^#[0-9a-f]{6}$/i.test(saved.background)
      )
        return { ...defaults, ...saved };
    } catch {
      /* Start with the business branding if storage is unavailable. */
    }
    return defaults;
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      /* QR customization remains usable without browser storage. */
    }
  }, [settings, storageKey]);
  const update = (patch: Partial<Settings>) =>
    setSettings((previous) => ({ ...previous, ...patch }));
  return (
    <section
      className={`onboard-qr-customizer ${layout === "split" ? "qr-customizer-split" : ""}`}
      aria-label="Customize your QR code"
    >
      <div className="qr-customizer-controls">
        <h3>Make your QR code yours</h3>
        <p className="onboard-help">
          Choose a style, add your logo, and download your design.
        </p>
        {!custom && (
          <p className="onboard-help">
            {access.isError
              ? access.error?.message
              : "Custom QR colors, styles, and logos are available with Growth and Pro."}{" "}
            <Link to="/upgrade">View plans</Link>
          </p>
        )}
        <fieldset
          disabled={!custom}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <div
            className="onboard-qr-styles"
            role="group"
            aria-label="QR code style"
          >
            {(
              [
                ["square", "Classic"],
                ["rounded", "Rounded"],
                ["dots", "Dots"],
              ] as const
            ).map(([style, label]) => (
              <button
                type="button"
                key={style}
                aria-pressed={(custom ? settings.style : "square") === style}
                onClick={() => update({ style })}
              >
                <span
                  className={`qr-style-swatch qr-style-${style}`}
                  aria-hidden="true"
                >
                  {Array.from({ length: 9 }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                {label}
              </button>
            ))}
          </div>
          <div className="onboard-qr-colors">
            <label>
              QR color
              <input
                type="color"
                value={custom ? settings.foreground : "#253147"}
                onChange={(e) => update({ foreground: e.target.value })}
              />
            </label>
            <label>
              Background
              <input
                type="color"
                value={custom ? settings.background : "#ffffff"}
                onChange={(e) => update({ background: e.target.value })}
              />
            </label>
          </div>
          <label className="onboard-qr-logo-toggle">
            <Toggle
              checked={custom && settings.includeLogo}
              onChange={(e) => update({ includeLogo: e.target.checked })}
            />
            Include a logo in the QR code
          </label>
          {custom && settings.includeLogo && (
            <>
              <ImageUpload
                label="QR code logo"
                value={settings.logo}
                upload={(file) => uploadImage(file, businessId)}
                onChange={(logo) => update({ logo })}
              />
              {businessLogo && settings.logo !== businessLogo && (
                <button
                  type="button"
                  className="onboard-qr-reset"
                  onClick={() => update({ logo: businessLogo })}
                >
                  Use business logo
                </button>
              )}
            </>
          )}
        </fieldset>
      </div>
      <div className="qr-customizer-preview">
        <QRPreview
          url={url}
          style={custom ? settings.style : "square"}
          foreground={custom ? settings.foreground : "#253147"}
          background={custom ? settings.background : "#ffffff"}
          logo={custom && settings.includeLogo ? settings.logo : ""}
        />
      </div>
    </section>
  );
}
