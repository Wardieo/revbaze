import { useEffect, useRef, useState } from "react";
import { slugAvailable } from "../services/onboarding";
import { slugify, validateSlug } from "../lib/validation";

export function usePublicSlug({
  slug,
  cardId,
  automatic,
  name,
  onGenerated,
}: {
  slug: string;
  cardId: string;
  automatic: boolean;
  name: string;
  onGenerated: (slug: string) => void;
}) {
  const generated = useRef(onGenerated);
  useEffect(() => {
    generated.current = onGenerated;
  });
  const [result, setResult] = useState({
    slug: "",
    message: "Checking availability…",
  });
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        let candidate = slug;
        let base = slugify(name).replace(/-+$/, "") || "business";
        try {
          validateSlug(base);
        } catch {
          base = `${base.slice(0, 50).replace(/-+$/, "")}-reviews`;
        }
        for (let attempt = 0; attempt < 12 && alive; attempt++) {
          let valid = true;
          try {
            validateSlug(candidate);
          } catch (error) {
            if (!automatic) throw error;
            valid = false;
          }
          if (valid && (await slugAvailable(candidate, cardId))) {
            if (!alive) return;
            if (candidate !== slug) generated.current(candidate);
            setResult({ slug: candidate, message: "" });
            return;
          }
          if (!automatic)
            throw new Error("This URL is already taken. Choose another slug.");
          candidate = `${base.slice(0, 48).replace(/-+$/, "")}-${crypto.randomUUID().slice(0, 8)}`;
        }
        if (alive)
          throw new Error("Unable to find an available URL. Try again.");
      } catch (error) {
        if (alive)
          setResult({
            slug,
            message:
              error instanceof Error
                ? error.message
                : "Unable to check URL availability.",
          });
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slug, cardId, automatic, name]);
  let format = "";
  try {
    validateSlug(slug);
  } catch (error) {
    format = (error as Error).message;
  }
  const message =
    result.slug === slug ? result.message : "Checking availability…";
  return {
    message: automatic ? message : format || message,
    available: !format && result.slug === slug && !result.message,
  };
}
