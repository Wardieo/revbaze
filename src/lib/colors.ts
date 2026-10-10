export function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function validateQRColors(foreground: string, background: string) {
  const dark = luminance(foreground),
    light = luminance(background);
  if (dark >= light || (light + 0.05) / (dark + 0.05) < 4.5)
    throw new Error(
      "Choose a dark foreground and a light background with stronger contrast so your QR code can be scanned.",
    );
}
export function readableText(background: string) {
  return luminance(background) < 0.35 ? "#f0f3f8" : "#303846";
}
