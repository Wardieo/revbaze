import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { beginOnboarding, saveOnboarding } from "../../services/onboarding";
import { initialData } from "./model";
import type { DraftRow, OnboardingData } from "./model";
export function useOnboardingDraft(session: Session, newBusiness: boolean) {
  const [row, setRow] = useState<DraftRow | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const rowRef = useRef<DraftRow | null>(null);
  const dataRef = useRef<OnboardingData | null>(null);
  const stepRef = useRef(1);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [account] = useState(() => ({
    name:
      session.user.user_metadata.name ||
      session.user.user_metadata.full_name ||
      "",
    email: session.user.email || "",
    avatar: session.user.user_metadata.avatar_url || "",
  }));
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    beginOnboarding(newBusiness)
      .then((result) => {
        if (!alive) return;
        rowRef.current = result;
        const initial = initialData(
          result,
          account.name,
          account.email,
          account.avatar,
        );
        dataRef.current = initial;
        stepRef.current = result.step;
        setRow(result);
        setData(initial);
        setStep(result.step);
        setSaved(Boolean(result.completed_at));
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
      mounted.current = false;
    };
  }, [newBusiness, session.user.id, account]);
  const save = useCallback((nextStep?: number) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const snapshot = dataRef.current;
    const target = nextStep ?? stepRef.current;
    if (!snapshot)
      return Promise.reject(new Error("Your draft is still loading."));
    const operation = queue.current.then(async () => {
      const current = rowRef.current;
      if (!current) throw new Error("Your draft is still loading.");
      if (current.completed_at) return current;
      if (mounted.current) {
        setSaving(true);
        setError("");
      }
      try {
        const result = await saveOnboarding(current, snapshot, target);
        rowRef.current = result;
        if (mounted.current) {
          setRow(result);
          setSaved(dataRef.current === snapshot);
        }
        return result;
      } catch (err) {
        if (mounted.current) {
          setError(
            err instanceof Error ? err.message : "Unable to save your draft.",
          );
          setSaved(false);
        }
        throw err;
      } finally {
        if (mounted.current) setSaving(false);
      }
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, []);
  useEffect(() => {
    if (!data || row?.completed_at) return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 650);
    autoTimer.current = timer;
    return () => clearTimeout(timer);
  }, [data, step, save, row?.completed_at]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!saved && data && !row?.completed_at) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved, data, row?.completed_at]);
  const update = (next: OnboardingData) => {
    dataRef.current = next;
    setData(next);
    setSaved(false);
  };
  const move = (next: number) => {
    stepRef.current = next;
    setStep(next);
  };
  const complete = (result: DraftRow) => {
    rowRef.current = result;
    setRow(result);
    move(5);
    setSaved(true);
  };
  return {
    row,
    data,
    step,
    error,
    saving,
    saved,
    save,
    update,
    move,
    complete,
  };
}
