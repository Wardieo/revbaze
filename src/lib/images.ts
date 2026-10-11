export const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;
export function validateImage(file: Pick<File, "name" | "type" | "size">) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const valid =
    (file.type === "image/png" && extension === "png") ||
    (file.type === "image/jpeg" &&
      (extension === "jpg" || extension === "jpeg"));
  if (!valid || file.size <= 0 || file.size >= IMAGE_SIZE_LIMIT)
    throw new Error("Choose a PNG, JPG, or JPEG image under 10 MB.");
}

/** Decode and re-encode, stripping metadata and limiting transfer/storage size. */
export async function prepareImage(file: File): Promise<Blob> {
  validateImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to resize this image");
    if (file.type !== "image/png") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Unable to resize this image")),
        mime,
        0.85,
      ),
    );
    if (blob.size > 524288)
      throw new Error(
        "Choose a simpler image; the resized image must be under 512 KB",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
