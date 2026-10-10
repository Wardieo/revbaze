import { BrandLogo } from "../../components/shared/BrandLogo";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/shared/Feedback";
import { supabase } from "../../lib/supabase";
import { slugify } from "../../lib/validation";
import { publishOnboarding } from "../../services/onboarding";
import { stepError } from "./model";
import { useOnboardingDraft } from "./useOnboardingDraft";
import { AccountStep } from "./AccountStep";
import { BusinessStep } from "./BusinessStep";
import { PlatformsStep } from "./PlatformsStep";
import { CustomizeStep } from "./CustomizeStep";
import { PublishStep } from "./PublishStep";
import { OnboardingAside } from "../../components/onboarding/OnboardingAside";
import "./onboarding.css";
const labels = [
  "Your account",
  "Your business",
  "Review platforms",
  "Your card",
  "Ready to share",
];
const titles = [
  "Welcome to Revbaze. Let’s set up your business.",
  "Tell us about your business.",
  "Where should customers leave reviews?",
  "Make your review card yours.",
  "Your review card is ready!",
];
const descriptions = [
  "Create one beautiful link where your customers can choose where to leave a review.",
  "A few details to make your review card feel like you.",
  "Add your official review links. One invitation, all your favorite destinations.",
  "Start with our defaults or add your own touch.",
  "A little link. A world of honest feedback.",
];
export function OnboardingPage({ session }: { session: Session }) {
  const location = useLocation();
  const newBusiness = new URLSearchParams(location.search).get("new") === "1";
  const draft = useOnboardingDraft(session, newBusiness);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slugState, setSlugState] = useState("Checking availability…");
  const [direction, setDirection] = useState(1);
  const reduced = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const client = useQueryClient();
  const onSlugState = useCallback((state: string) => setSlugState(state), []);
  useEffect(() => {
    const timer = setTimeout(() => heading.current?.focus(), reduced ? 0 : 300);
    return () => clearTimeout(timer);
  }, [draft.step, draft.row?.id, reduced]);
  const validation = draft.data ? stepError(draft.data, draft.step) : "";
  async function advance() {
    if (!draft.data || !draft.row || busy) return;
    setError("");
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      if (draft.step === 1) {
        const { error } = await supabase!.auth.updateUser({
          data: { name: draft.data.name.trim(), avatar_url: draft.data.avatar },
        });
        if (error) throw error;
      }
      if (draft.step === 4) {
        if (slugState) throw new Error(slugState);
        const saved = await draft.save();
        const result = await publishOnboarding(saved);
        draft.complete(result.draft);
        navigate(`/onboarding?published=${result.draft.card_id}`, {
          replace: true,
          state: { businessSetup: true },
        });
      } else {
        if (draft.step === 3 && !draft.data.card.slug)
          draft.update({
            ...draft.data,
            card: {
              ...draft.data.card,
              slug: slugify(draft.data.business.name) || "your-business",
            },
          });
        await draft.save(draft.step + 1);
        setDirection(1);
        draft.move(draft.step + 1);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    try {
      await client.invalidateQueries({ queryKey: ["onboarding-status"] });
      await client.invalidateQueries({ queryKey: ["workspace"] });
      navigate("/overview", { replace: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="app onboard-shell">
        <header className="onboard-header">
          {newBusiness ? (
            <Link to="/overview" className="auth-brand" aria-label="Back to dashboard"><BrandLogo /></Link>
          ) : (
            <span className="auth-brand"><BrandLogo /></span>
          )}
          <span className="onboard-save-state" role="status">
            {draft.saving ? (
              <>
                <LoaderCircle size={13} className="onboard-spinner" />
                Saving draft…
              </>
            ) : draft.saved ? (
              <>
                <Check size={13} />
                Saved securely
              </>
            ) : (
              "Unsaved changes"
            )}
          </span>
        </header>
        <div className="onboard-layout">
          <div className="onboard-container">
            <nav className="onboard-progress" aria-label="Onboarding progress">
              {labels.map((label, i) => (
                <div
                  key={label}
                  className={
                    draft.step > i + 1
                      ? "done"
                      : draft.step === i + 1
                        ? "current"
                        : ""
                  }
                  aria-current={draft.step === i + 1 ? "step" : undefined}
                >
                  <span>
                    {draft.step > i + 1 ? <Check size={13} /> : i + 1}
                  </span>
                  <small>{label}</small>
                </div>
              ))}
            </nav>
            <div className="onboard-progress-track">
              <motion.div
                initial={false}
                animate={{ width: `${(draft.step / 5) * 100}%` }}
                transition={{ duration: reduced ? 0 : 0.3 }}
              />
            </div>
            {!draft.data || !draft.row ? (
              draft.error ? (
                <div className="card error-state">
                  <h2>Your onboarding couldn’t load</h2>
                  <p role="alert">{draft.error}</p>
                  <p>
                    Apply the Supabase migrations from this project to enable
                    server-saved onboarding.
                  </p>
                  <Button onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <Skeleton />
              )
            ) : (
              <>
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.section
                    key={draft.step}
                    custom={direction}
                    initial={
                      reduced ? false : { opacity: 0, x: direction * 16 }
                    }
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reduced ? undefined : { opacity: 0, x: direction * -12 }
                    }
                    transition={{ duration: 0.25 }}
                    className="onboard-step"
                  >
                    <div className="onboard-step-heading">
                      <span className="eyebrow">
                        STEP {draft.step} OF 5
                        {draft.step === 1 && draft.data.name
                          ? ` · HELLO, ${draft.data.name.split(" ")[0].toUpperCase()}`
                          : ""}
                      </span>
                      <h1 ref={heading} tabIndex={-1}>
                        {titles[draft.step - 1]}
                      </h1>
                      <p>{descriptions[draft.step - 1]}</p>
                    </div>
                    <fieldset disabled={busy} className="onboard-form-panel">
                      <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: { staggerChildren: reduced ? 0 : 0.05 },
                          },
                        }}
                      >
                        {draft.step === 1 ? (
                          <AccountStep
                            data={draft.data}
                            email={session.user.email || ""}
                            update={draft.update}
                          />
                        ) : draft.step === 2 ? (
                          <BusinessStep
                            data={draft.data}
                            update={draft.update}
                            save={draft.save}
                          />
                        ) : draft.step === 3 ? (
                          <PlatformsStep
                            data={draft.data}
                            update={draft.update}
                          />
                        ) : draft.step === 4 ? (
                          <CustomizeStep
                            data={draft.data}
                            row={draft.row}
                            update={draft.update}
                            onSlugState={onSlugState}
                          />
                        ) : (
                          <PublishStep
                            data={draft.data}
                            busy={busy}
                            finish={() => void finish()}
                          />
                        )}
                      </motion.div>
                    </fieldset>
                  </motion.section>
                </AnimatePresence>
                {(error || draft.error) && (
                  <motion.div
                    className="onboard-error"
                    initial={reduced ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                  >
                    {error || draft.error}
                    {draft.error && (
                      <Button
                        onClick={() => void draft.save().catch(() => {})}
                        disabled={busy}
                      >
                        Retry save
                      </Button>
                    )}
                  </motion.div>
                )}
                {draft.step < 5 && (
                  <div className="onboard-actions">
                    <Button
                      disabled={draft.step === 1 || busy}
                      onClick={() => {
                        setDirection(-1);
                        setError("");
                        draft.move(draft.step - 1);
                      }}
                    >
                      <ArrowLeft size={15} />
                      Back
                    </Button>
                    <span>
                      <ShieldCheck size={13} />
                      Your draft is saved as you go
                    </span>
                    <motion.div
                      whileHover={reduced ? undefined : { y: -1 }}
                      whileTap={reduced ? undefined : { scale: 0.98 }}
                    >
                      <Button
                        variant="primary"
                        disabled={
                          busy ||
                          Boolean(validation) ||
                          (draft.step === 4 && Boolean(slugState))
                        }
                        onClick={() => void advance()}
                      >
                        {busy ? (
                          <>
                            <LoaderCircle
                              className="onboard-spinner"
                              size={15}
                            />
                            {draft.step === 4 ? "Publishing…" : "Saving…"}
                          </>
                        ) : (
                          <>
                            {draft.step === 1
                              ? "Get Started"
                              : draft.step === 4
                                ? "Publish review card"
                                : "Continue"}
                            <ArrowRight size={15} />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                )}
              </>
            )}
          </div>
          <OnboardingAside
            data={draft.data}
            row={draft.row}
            step={draft.step}
          />
        </div>
        <footer className="onboard-footer">
          One link. Every review platform.
          <button
            onClick={async () => {
              try {
                if (draft.data && !draft.row?.completed_at) await draft.save();
              } catch {
                return;
              }
              await supabase?.auth.signOut();
              client.clear();
              navigate("/login", { replace: true });
            }}
          >
            Save & sign out
          </button>
        </footer>
      </div>
    </MotionConfig>
  );
}
