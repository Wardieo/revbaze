import { clearSignupPlan, hasSignupPlanChoice } from "../../lib/signupPlan";
import { passwordStrength } from "../../lib/password";
import { useEffect, useId, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Mail, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase, authCallback, canResetPassword, clearPasswordRecovery, isPasswordRecoverySession, signOutFully } from "../../lib/supabase";
import { authErrorMessage, confirmationRedirect } from "../../lib/auth";
import { Button } from "../../components/ui/Button";
import type { Session } from "@supabase/supabase-js";
const pendingKey = "revbaze-confirmation-email";
const confirmationCooldownKey = "revbaze-confirmation-cooldown";
const confirmationCooldownMs = 120_000;
function confirmationDeadline() {
  try {
    const deadline = Number(localStorage.getItem(confirmationCooldownKey));
    return Number.isFinite(deadline) ? deadline : 0;
  } catch {
    return 0;
  }
}
function startConfirmationCooldown() {
  const deadline = Date.now() + confirmationCooldownMs;
  try {
    localStorage.setItem(confirmationCooldownKey, String(deadline));
  } catch {
    /* The countdown still works in memory when storage is unavailable. */
  }
  return deadline;
}
function redirect(recovery = false) {
  return confirmationRedirect(
    window.location.origin,
    window.location.pathname,
    recovery,
  );
}
function remember(email: string) {
  sessionStorage.setItem(pendingKey, email);
}
function Notice({
  text,
  success = false,
}: {
  text: string;
  success?: boolean;
}) {
  return text ? (
    <p
      className={`auth-notice ${success ? "success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {text}
    </p>
  ) : null;
}
export function Password({
  label,
  value,
  change,
  existing = false,
  strength = false,
  mismatch = false,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
  existing?: boolean;
  strength?: boolean;
  mismatch?: boolean;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const level = passwordStrength(value);
  const rating = ["Weak", "Medium", "Strong"][level - 1];
  return (
    <label>
      {label}
      <div className="auth-password">
        <input
          required
          aria-invalid={mismatch || undefined}
          aria-describedby={
            mismatch
              ? `${id}-mismatch`
              : strength
                ? `${id}-strength`
                : undefined
          }
          minLength={existing ? undefined : 8}
          type={show ? "text" : "password"}
          autoComplete={existing ? "current-password" : "new-password"}
          value={value}
          onChange={(e) => change(e.target.value)}
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {strength && (
        <div
          className={`password-strength strength-${value ? level : 0}`}
          id={`${id}-strength`}
        >
          <span className="password-strength-bars" aria-hidden="true">
            {[1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={value && segment <= level ? "filled" : ""}
              />
            ))}
          </span>
          <span className="password-strength-caption" aria-live="polite">
            <span>{value ? rating : "Use at least 8 characters."}</span>
            {value && (
              <span>
                {level === 3
                  ? "Looking good."
                  : level === 1
                    ? "Use a medium or strong password to continue."
                    : "Try a longer mix of letters, numbers & symbols."}
              </span>
            )}
          </span>
        </div>
      )}
      {mismatch && (
        <span
          className="password-mismatch"
          id={`${id}-mismatch`}
          aria-live="polite"
        >
          Passwords don't match.
        </span>
      )}
    </label>
  );
}
export function AuthPage({
  signup = false,
  session,
}: {
  signup?: boolean;
  session: Session | null;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const signupSucceeded = useRef(false);
  useEffect(() => () => {
    // Keep the pricing choice valid until the signup screen has actually left.
    // Clearing it before navigation can make the guard redirect to Pricing.
    if (signupSucceeded.current) clearSignupPlan();
  }, []);
  const navigate = useNavigate();
  const [signupParams] = useSearchParams();
  const requestedPlan = signupParams.get("plan");
  const validPlanChoice = hasSignupPlanChoice(requestedPlan);
  const selectedPlan = validPlanChoice ? requestedPlan : "free";
  useEffect(() => {
    if (signup && !session && !validPlanChoice)
      window.location.replace("/pricing");
  }, [signup, session, validPlanChoice]);
  if (signup && !session && !validPlanChoice) return null;
  if (session) return <Navigate to={isPasswordRecoverySession(session.user.id) ? "/reset-password" : "/overview"} replace />;
  return (
    <section>
      <span className="eyebrow">YOUR REVIEW LINK WORKSPACE</span>
      <h1>{signup ? "Create your account." : "Welcome back."}</h1>
      <p className="auth-subtitle">
        {signup
          ? "Start inviting feedback in a few simple steps."
          : "Sign in to manage your review cards and business."}
      </p>
      {signup && selectedPlan !== "free" && (
        <p className="auth-subtitle">
          {selectedPlan === "growth" ? "Growth · $10/month" : "Pro · $29/month"}{" "}
          billed monthly. After email confirmation, complete payment
          at checkout before setting up your business.
        </p>
      )}
      {signup && (
        <p className="auth-next">
          Selected plan:{" "}
          <strong>
            {selectedPlan === "free"
              ? "Free"
              : selectedPlan === "growth"
                ? "Growth"
                : "Pro"}
          </strong>{" "}
          ·{" "}
          <a className="text-link" href="/pricing">
            Change plan
          </a>
        </p>
      )}
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (signup && !hasSignupPlanChoice(requestedPlan)) {
            window.location.replace("/pricing");
            return;
          }
          setError("");
          setUnconfirmed(false);
          if (signup && passwordStrength(password) === 1) {
            setError(
              "Choose a medium or strong password to create your account.",
            );
            return;
          }
          if (!supabase) {
            setError(
              "Cloud authentication is not configured. Configure Supabase to sign in.",
            );
            return;
          }
          if (signup && password !== confirm) {
            setError("Your passwords don't match.");
            return;
          }
          setBusy(true);
          try {
            if (signup) {
              const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                  emailRedirectTo: redirect(),
                  data: { name: name.trim(), signup_plan: selectedPlan },
                },
              });
              if (error) throw error;
              if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                throw { code: "user_already_exists" };
              }
              signupSucceeded.current = true;
              if (data.session) navigate("/overview", { replace: true });
              else {
                startConfirmationCooldown();
                remember(email.trim());
                navigate("/check-email");
              }
            } else {
              const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (error) {
                setUnconfirmed(error.code === "email_not_confirmed");
                throw error;
              }
              navigate("/overview", { replace: true });
            }
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {signup && (
          <label>
            Your name
            <input
              required
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@your-business.com"
          />
        </label>
        <Password
          label="Password"
          value={password}
          change={setPassword}
          existing={!signup}
          strength={signup}
        />
        {signup && (
          <>
            <Password
              label="Confirm password"
              value={confirm}
              change={setConfirm}
              mismatch={Boolean(confirm) && confirm !== password}
            />
          </>
        )}
        {!signup && (
          <Link className="text-link auth-forgot" to="/forgot-password">
            Forgot password?
          </Link>
        )}
        <Notice text={error} />
        {unconfirmed && (
          <Link
            className="text-link"
            to="/check-email"
            onClick={() => remember(email.trim())}
          >
            Resend confirmation email
          </Link>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={busy || (signup && passwordStrength(password) === 1)}
        >
          {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          <ArrowRight size={16} />
        </Button>
      </form>
      {signup && (
        <p className="auth-next">
          By creating an account, you agree to our{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>{" "}
          and acknowledge our{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
      )}
      <p className="auth-switch">
        {signup ? "Already have an account?" : "New to Revbaze?"}{" "}
        {signup ? (
          <Link to="/login">Sign in</Link>
        ) : (
          <a href="/pricing">Choose plans</a>
        )}
      </p>

    </section>
  );
}
export function CheckEmailPage() {
  const [email, setEmail] = useState(
    () => sessionStorage.getItem(pendingKey) || "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState(confirmationDeadline);
  const [now, setNow] = useState(Date.now);
  const sending = useRef(false);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    const sync = (event: StorageEvent) => {
      if (event.key === confirmationCooldownKey) {
        setDeadline(confirmationDeadline());
        tick();
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <section>
      <span className="auth-status-icon">
        <Mail size={28} />
      </span>
      <h1>Check your inbox.</h1>
      <p className="auth-subtitle">
        Open the confirmation link in your email. Once verified, we'll help you
        set up your business and first review card.
      </p>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (sending.current) return;
          setError("");
          setMessage("");
          if (!supabase) {
            setError("Cloud authentication is not configured.");
            return;
          }
          const currentDeadline = Math.max(deadline, confirmationDeadline());
          if (Date.now() < currentDeadline) {
            setDeadline(currentDeadline);
            setNow(Date.now());
            return;
          }
          sending.current = true;
          setBusy(true);
          try {
            const { error } = await supabase.auth.resend({
              type: "signup",
              email: email.trim(),
              options: { emailRedirectTo: redirect() },
            });
            if (error) throw error;
            remember(email.trim());
            setDeadline(startConfirmationCooldown());
            setNow(Date.now());
            setMessage(
              "Confirmation requested. Check your inbox and spam folder.",
            );
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            sending.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <Notice text={error} />
        <Notice text={message} success />
        <Button variant="primary" disabled={busy || remaining > 0}>
          {busy ? "Sending…" : remaining > 0 ? `Resend in ${countdown}` : "Resend confirmation email"}
        </Button>
      </form>
      <p className="auth-next">
        Can't find it? Check spam and make sure the address is correct. If
        delivery keeps failing, contact your workspace administrator.
      </p>
      <Link className="text-link" to="/login">
        Back to sign in
      </Link>
    </section>
  );
}
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const sending = useRef(false);
  const cooldownKey = "revbaze-forgot-password-cooldown";
  const readDeadline = () => {
    try {
      const value = Number(localStorage.getItem(cooldownKey));
      return Number.isFinite(value) ? value : 0;
    } catch { return 0; }
  };
  const [deadline, setDeadline] = useState(readDeadline);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = (event: StorageEvent) => {
      if (event.key === cooldownKey) {
        const value = Number(event.newValue);
        setDeadline(Number.isFinite(value) ? value : 0);
        setNow(Date.now());
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <section>
      <span className="auth-status-icon"><Mail size={28} /></span>
      <h1>Forgot your password?</h1>
      <p className="auth-subtitle">
        We'll email you a link to choose a new password.
      </p>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (sending.current) return;
          const currentDeadline = Math.max(deadline, readDeadline());
          if (Date.now() < currentDeadline) {
            setDeadline(currentDeadline);
            setNow(Date.now());
            return;
          }
          sending.current = true;
          setError("");
          setSent(false);
          setBusy(true);
          try {
            if (!supabase)
              throw new Error("Cloud authentication is not configured.");
            const { error } = await supabase.auth.resetPasswordForEmail(
              email.trim(),
              { redirectTo: redirect(true) },
            );
            if (error) throw error;
            setSent(true);
            const nextDeadline = Date.now() + 60_000;
            setDeadline(nextDeadline);
            setNow(Date.now());
            try { localStorage.setItem(cooldownKey, String(nextDeadline)); }
            catch { /* In-memory cooldown remains available. */ }
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            sending.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSent(false); setError(""); }}
          />
        </label>
        <Notice text={error} />
        <Notice
          success
          text={
            sent
              ? "If an account exists for this email, a reset link has been requested. Check your inbox and spam folder."
              : ""
          }
        />
        <Button variant="primary" disabled={busy || remaining > 0 || !supabase}>
          {busy ? "Sending…" : remaining > 0 ? `Resend in ${countdown}` : "Send reset link"}
        </Button>
      </form>
      <p className="auth-switch">
        <Link
          to="/login"
          onClick={(event) => {
            if (!supabase) return;
            event.preventDefault();
            void signOutFully();
          }}
        >
          Back to sign in
        </Link>
      </p>
    </section>
  );
}
export function AuthCallbackPage({ session }: { session: Session | null }) {
  if (session && !authCallback.error)
    return <Navigate to={isPasswordRecoverySession(session.user.id) ? "/reset-password" : "/overview"} replace />;
  return (
    <section>
      <h1>Let's verify your email.</h1>
      <Notice
        text={
          authCallback.error ||
          "This link is missing, expired, or has already been used. Sign in if you already confirmed your email, or request a new link."
        }
      />
      <div className="auth-options">
        <Link
          className="text-link"
          to={authCallback.recovery ? "/forgot-password" : "/check-email"}
        >
          Request a new link
        </Link>
        <Link className="text-link" to="/login">
          Sign in
        </Link>
      </div>
    </section>
  );
}
export function ResetPasswordPage({ session }: { session: Session | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!done && (!session || !canResetPassword(session.user.id)))
    return (
      <section>
        <h1>Request a fresh reset link.</h1>
        <p className="auth-subtitle">
          Open a valid password reset email before choosing your new password.
        </p>
        <Link className="text-link" to="/forgot-password">
          Send a reset link
        </Link>
      </section>
    );
  if (done)
    return (
      <section>
        <span className="auth-status-icon">
          <CheckCircle2 size={28} />
        </span>
        <h1>Password updated.</h1>
        <p className="auth-subtitle">Your new password is ready to use.</p>
        <Button asChild variant="primary">
          <Link to="/">
            Continue to your workspace
            <ArrowRight size={16} />
          </Link>
        </Button>
      </section>
    );
  return (
    <section>
      <h1>Choose a new password.</h1>
      <p className="auth-subtitle">
        Use at least 8 characters and choose a medium or strong password.
      </p>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (passwordStrength(password) === 1) {
            setError("Choose a medium or strong password to continue.");
            return;
          }
          if (password !== confirm) {
            setError("Your passwords don't match.");
            return;
          }
          setBusy(true);
          try {
            if (!supabase)
              throw new Error("Cloud authentication is not configured.");
            if (!canResetPassword(session?.user.id))
              throw new Error("Open a fresh password reset email before changing your password.");
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            clearPasswordRecovery();
            setDone(true);
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Password label="New password" value={password} change={setPassword} strength />
        <Password
          label="Confirm password"
          value={confirm}
          change={setConfirm}
          mismatch={Boolean(confirm) && confirm !== password}
        />
        <Notice text={error} />
        <Button variant="primary" disabled={busy || passwordStrength(password) === 1 || password !== confirm}>
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </section>
  );
}
