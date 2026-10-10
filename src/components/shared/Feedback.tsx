import { FeedbackContext } from "../../hooks/useFeedback";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <FeedbackContext.Provider
      value={(message, error = false) => setToast({ message, error })}
    >
      {children}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input,select,textarea",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close dialog"
          className="modal-close icon-button"
          onClick={close}
        >
          <X size={19} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function ConfirmDialog({
  title,
  description,
  confirm,
  close,
  busy,
}: {
  title: string;
  description: string;
  confirm: () => void;
  close: () => void;
  busy: boolean;
}) {
  return (
    <Dialog title={title} close={close}>
      <p className="muted">{description}</p>
      <div className="modal-actions">
        <Button onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button className="danger" onClick={confirm} disabled={busy}>
          {busy ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Dialog>
  );
}
export function PageHeading({
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return children ? (
    <div className="page-heading" aria-label={`${title} actions`}>
      {children}
    </div>
  ) : null;
}
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Skeleton() {
  return (
    <div
      aria-label="Loading workspace"
      role="status"
      className="loading-skeleton"
    >
      <div />
      <section>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} />
        ))}
      </section>
      <div />
    </div>
  );
}
