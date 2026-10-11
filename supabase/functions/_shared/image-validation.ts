/** Read dimensions before decoding; reject truncated, oversized and non-image uploads. */
export function validateImageBytes(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > 524288)
    throw new Error("Image must be under 512 KB after resizing");
  let width = 0,
    height = 0;
  if (mime === "image/png") {
    if (
      bytes.length < 33 ||
      [137, 80, 78, 71, 13, 10, 26, 10].some((b, i) => bytes[i] !== b) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
    )
      throw new Error("Invalid PNG image");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    width = view.getUint32(16);
    height = view.getUint32(20);
    if (String.fromCharCode(...bytes.slice(-8, -4)) !== "IEND")
      throw new Error("Incomplete PNG image");
  } else if (mime === "image/jpeg") {
    if (
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes.at(-2) !== 255 ||
      bytes.at(-1) !== 217
    )
      throw new Error("Invalid JPEG image");
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error("Invalid JPEG structure");
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length)
        throw new Error("Invalid JPEG segment");
      if ([192, 193, 194].includes(marker)) {
        if (length < 8) throw new Error("Invalid JPEG dimensions");
        height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        break;
      }
      offset += length;
    }
  } else throw new Error("Choose a PNG or JPEG image");
  if (!width || !height || width > 1024 || height > 1024)
    throw new Error("Image dimensions must be at most 1024 pixels");
}
