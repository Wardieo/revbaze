import { readableText } from "../../lib/colors";
import type { ReviewCard } from "../../types/workspace";
export function cardPageBackground(appearance: ReviewCard["appearance_settings"]) {
  const color = appearance.page_background || "#f3f6fa";
  const ink = readableText(color);
  const style = appearance.background_style || "abstract";
  const rings = `radial-gradient(circle at 100% 100%, transparent 0 24%, ${ink}26 24% 25%, ${ink}12 25% 33%, transparent 33% 40%, ${ink}18 40% 48%, transparent 48%)`;
  return {
    backgroundColor: color,
    backgroundImage: style === "abstract" ? `${rings}, radial-gradient(${ink}38 1px, transparent 1px), linear-gradient(135deg, ${ink}08, transparent)` : style === "waves" ? `radial-gradient(ellipse at 0% 100%, ${ink}30 0 25%, transparent 25% 38%, ${ink}20 38% 52%, transparent 52%), linear-gradient(145deg, ${ink}0d, transparent)` : style === "gradient" ? "linear-gradient(135deg, #ffffff22, #00000014)" : style === "dots" ? `radial-gradient(${ink}38 1px, transparent 1px)` : "none",
    backgroundSize: style === "abstract" ? "100% 100%, 24px 24px, 100% 100%" : style === "dots" ? "16px 16px" : "auto",
  };
}
