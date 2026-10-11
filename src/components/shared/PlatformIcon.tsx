import { brandLogos } from "../../lib/brandLogos";
import "./platform-logo.css";
import { getPlatform } from "../../lib/platforms";
export function PlatformIcon({
  id,
  small = false,
}: {
  id: string;
  small?: boolean;
}) {
  const p = getPlatform(id);
  const logo = brandLogos[id];
  const name =
    (
      {
        zapier: "Zapier",
        slack: "Slack",
        mailchimp: "Mailchimp",
        make: "Make",
        n8n: "n8n",
      } as Record<string, string>
    )[id] || p.name;
  return (
    <span
      className={`platform-icon platform-${id} ${small ? "small" : ""} ${logo ? "has-brand-logo" : "has-placeholder"}`}
      style={{ color: p.color }}
      role="img"
      aria-label={name}
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          width={small ? 20 : 35}
          height={small ? 20 : 35}
          decoding="async"
        />
      ) : (
        p.icon
      )}
    </span>
  );
}
