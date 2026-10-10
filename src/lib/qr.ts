import QRCode from "qrcode";
import { validateQRColors } from "./colors";
export type QRStyle = "square" | "rounded" | "dots";
export function qrSvg(
  url: string,
  foreground: string,
  background: string,
  style: QRStyle = "square",
) {
  validateQRColors(foreground, background);
  const code = QRCode.create(url, { errorCorrectionLevel: "H" });
  const size = code.modules.size;
  const dimension = size + 8;
  const modules: string[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!code.modules.get(y, x)) continue;
      const finder =
        (x < 8 && y < 8) ||
        (x >= size - 8 && y < 8) ||
        (x < 8 && y >= size - 8);
      const reserved = code.modules.isReserved(x, y);
      modules.push(
        style === "dots" && !finder && !reserved
          ? `<circle cx="${x + 4.5}" cy="${y + 4.5}" r="0.48"/>`
          : `<rect x="${x + 4}" y="${y + 4}" width="1" height="1" rx="${style === "rounded" && !finder && !reserved ? 0.22 : 0}"/>`,
      );
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="400" height="400"><rect width="${dimension}" height="${dimension}" fill="${background}"/><g fill="${foreground}">${modules.join("")}</g></svg>`;
}
export function loadQRImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load QR image or logo."));
    image.src = src;
  });
}
export async function renderQR(
  url: string,
  foreground: string,
  background: string,
  style: QRStyle,
  logo: string,
) {
  let svg = qrSvg(url, foreground, background, style);
  if (logo) {
    const image = await loadQRImage(logo);
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const scale = Math.min(100 / image.naturalWidth, 100 / image.naturalHeight);
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    canvas
      .getContext("2d")!
      .drawImage(image, (100 - width) / 2, (100 - height) / 2, width, height);
    const embedded = canvas.toDataURL("image/png");
    const dimension = Number(svg.match(/viewBox="0 0 (\d+)/)![1]);
    const size = dimension * 0.125,
      position = (dimension - size) / 2;
    svg = svg.replace(
      "</svg>",
      `<rect x="${position - 1}" y="${position - 1}" width="${size + 2}" height="${size + 2}" fill="${background}"/><image href="${embedded}" x="${position}" y="${position}" width="${size}" height="${size}"/></svg>`,
    );
  }
  const object = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml" }),
  );
  try {
    const image = await loadQRImage(object);
    const canvas = document.createElement("canvas");
    // Whole pixels per module preserve crisp edges and the four-module quiet zone.
    const dimension = Number(svg.match(/viewBox="0 0 (\d+)/)![1]);
    const pixels = dimension * Math.max(12, Math.ceil(800 / dimension));
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, pixels, pixels);
    return { svg, png: canvas.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(object);
  }
}
