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
