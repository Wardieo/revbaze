import { getPlatform } from "./platforms";
export function validateDestination(
  value: string,
  platformId = "custom",
): string {
  if (
    value.length > 2048 ||
    value !== value.trim() ||
    /[\s\\]/.test(value) ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  )
    throw new Error("Enter a valid HTTPS URL without spaces or backslashes.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("Use an HTTPS link without credentials or a custom port.");
  const host = url.hostname.toLowerCase();
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    /\.(localhost|local|internal|test|invalid)$/.test(host)
  )
    throw new Error(
      "Use a public destination domain, not a local address or IP address.",
    );
  const platform = getPlatform(platformId);
  if (
    platformId !== "custom" &&
    !platform.domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  )
    throw new Error(
      `Use an official ${platform.name} domain: ${platform.domains.join(", ")}.`,
    );
  if (platformId !== "custom") {
    if (
      ["/url", "/redirect", "/l.php", "/away"].includes(
        url.pathname.replace(/\/$/, ""),
      )
    )
      throw new Error(
        "Use a direct platform destination instead of a redirect link.",
      );
    for (const [key, target] of url.searchParams) {
      if (
        /^(url|q|u|redirect|redirect_url|redirect_uri|next|continue|returnurl)$/i.test(
          key,
        ) &&
        /^https?:/i.test(target)
      )
        throw new Error(
          "Use a direct platform destination instead of a redirect link.",
        );
    }
  }
  return url.href;
}
export function validateSlug(value: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(value))
    throw new Error(
      "Use 3–60 lowercase letters, numbers, or hyphens; start and end with a letter or number.",
    );
  if (
    [
      "overview",
      "review",
      "signup",
      "check-email",
      "forgot-password",
      "reset-password",
      "admin",
      "api",
      "app",
      "login",
      "settings",
      "cards",
      "analytics",
      "onboarding",
      "platforms",
      "qr-codes",
      "profile",
      "auth",
      "support",
    ].includes(value)
  )
    throw new Error("This URL is reserved. Choose another slug.");
  return value;
}
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
export function cardUrl(slug: string) {
  const current =
    typeof window !== "undefined"
      ? window.location.origin + "/"
      : "https://revbaze.com/";
  // Shared links and QR codes always use the configured public destination.
  const base = import.meta.env.VITE_PUBLIC_CARD_ORIGIN?.trim() || current;
  const url = new URL(base);
  url.search = "";
  url.hash = `/review/${encodeURIComponent(slug)}`;
  return url.toString();
}
export function cardQRUrl(slug: string, source = "qr") {
  return `${cardUrl(slug)}?utm_source=${encodeURIComponent(source.trim().toLowerCase() || "qr")}`;
}
export function validateColor(value: string) {
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error("Choose a valid hex color.");
  return value;
}
