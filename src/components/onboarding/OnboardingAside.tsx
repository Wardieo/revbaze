import { useLayoutEffect, useRef, useState } from "react";
import { CardPreview } from "../../features/review-cards/CardPreview";
import { cardPageBackground } from "../../features/review-cards/cardPageBackground";
import { draftPreview } from "../../features/onboarding/model";
import type { DraftRow, OnboardingData } from "../../features/onboarding/model";
export function OnboardingAside({
  data,
  row,
  step,
}: {
  data: OnboardingData | null;
  row: DraftRow | null;
  step: number;
}) {
  const panel = useRef<HTMLElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ height: 0, scale: 1 });
  const hasPreview = Boolean(data && row && step >= 4);
  useLayoutEffect(() => {
    if (!panel.current || !preview.current) return;
    const measure = () => {
      const height = preview.current!.offsetHeight;
      const style = getComputedStyle(panel.current!);
      const available = Math.max(
        1,
        window.innerHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom),
      );
      const scale = Math.min(1, available / Math.max(1, height));
      setFit((previous) =>
        previous.height === height * scale && previous.scale === scale
          ? previous
          : { height: height * scale, scale },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(preview.current);
    observer.observe(panel.current);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [hasPreview]);
  return (
    <aside ref={panel} className={`auth-story onboard-story ${hasPreview ? "has-card-backdrop" : ""}`} style={hasPreview && data && row ? cardPageBackground(draftPreview(row, data).appearance_settings) : undefined}>
      {data && row && step >= 4 && (
        <div
          className="onboard-story-preview"
          style={{ height: fit.height }}
          aria-label={
            step === 5 ? "Published review card" : "Live review card preview"
          }
        >
          <div
            ref={preview}
            className="onboard-fitted-preview"
            style={{ transform: `scale(${fit.scale})` }}
          >
            <CardPreview card={draftPreview(row, data)} links={data.links} />
          </div>
        </div>
      )}
    </aside>
  );
}
