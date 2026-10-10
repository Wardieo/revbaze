import { useEffect, useRef, useState } from "react";
/** Show success only after the clipboard write has completed. */
export function useCopyFeedback() {
  const [copiedValue, setCopiedValue] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function markCopied(value: string) {
    if (timer.current) clearTimeout(timer.current);
    setCopiedValue(value);
    timer.current = setTimeout(() => setCopiedValue(""), 2500);
  }
  return { copiedValue, markCopied };
}
