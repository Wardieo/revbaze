import { useEffect, useState } from "react";
import { renderQR } from "../../lib/qr";
import type { QRStyle } from "../../lib/qr";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useFeedback } from "../../hooks/useFeedback";
export function QRPreview({
  url,
  foreground = "#253147",
  background = "#ffffff",
  logo = "",
  style = "square",
  regenerate = 0,
}: {
  url: string;
  foreground?: string;
  background?: string;
  logo?: string;
  style?: QRStyle;
  regenerate?: number;
}) {
  const key = JSON.stringify([
    url,
    foreground,
    background,
    logo,
    style,
    regenerate,
  ]);
  const [result, setResult] = useState({
    key: "",
    png: "",
    svg: "",
    error: "",
  });
  const ready = result.key === key && Boolean(result.png);
  const notify = useFeedback();
  useEffect(() => {
    let active = true;
    const destination = new URL(url);
    if (destination.hash.startsWith("#/review/")) {
      const [path, query = ""] = destination.hash.split("?");
      const params = new URLSearchParams(query);
      if (!params.has("utm_source")) params.set("utm_source", "qr");
      destination.hash = `${path}?${params}`;
    }
    renderQR(destination.toString(), foreground, background, style, logo)
      .then((images) => {
        if (active) setResult({ key, ...images, error: "" });
      })
      .catch((err) => {
        if (active)
          setResult({
            key,
            png: "",
            svg: "",
            error:
              err instanceof Error
                ? err.message
                : "Unable to generate QR code.",
          });
      });
    return () => {
      active = false;
    };
  }, [url, foreground, background, style, logo, key]);
  function download(format: "png" | "svg") {
    if (!ready) return;
    const object =
      format === "svg"
        ? URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }))
        : "";
    const a = document.createElement("a");
    a.href = object || result.png;
    a.download = `revbaze-qr.${format}`;
    a.click();
    if (object) setTimeout(() => URL.revokeObjectURL(object), 1000);
    notify("QR code downloaded.");
  }
  return (
    <div className="qr-preview">
      <div className="qr-image">
        {result.key === key && result.error ? (
          <p role="alert" className="form-error">
            {result.error}
          </p>
        ) : ready ? (
          <img src={result.png} alt={`QR code pointing to ${url}`} />
        ) : (
          <div className="qr-loading" role="status">
            Generating QR code…
          </div>
        )}
      </div>
      <div className="qr-downloads">
        <Button disabled={!ready} onClick={() => download("png")}>
          <Download size={14} />
          PNG
        </Button>
        <Button disabled={!ready} onClick={() => download("svg")}>
          <Download size={14} />
          SVG
        </Button>
      </div>
      <small>Scan-test before printing, especially after adding a logo.</small>
    </div>
  );
}
