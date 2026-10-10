import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Heart, LoaderCircle, MessageSquare, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./contact.css";

export function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const submission = useRef<{ payload: string; id: string } | null>(null);
  const sending = useRef(false);
  return <div className="contact-page m-container">
    <section className="contact-heading"><span className="contact-eyebrow">CONTACT REVBAZE</span><h1>Good conversations<br />start with a hello.</h1><p>A question about the product, an idea to share, or a little help getting started. Tell us what’s on your mind.</p></section>
    <section className="contact-layout">
      <div className="contact-aside">
        <div className="contact-illustration" aria-hidden="true"><div className="contact-ring" /><div className="contact-bubble"><MessageSquare size={32} /><span>Let’s connect.</span></div><div className="contact-small-bubble"><Heart size={22} /></div><span className="contact-spark">+</span></div>
        <div className="contact-help"><h2>A little direction?</h2><p>Explore the guides for creating review cards, sharing QR codes, and inviting honest feedback.</p><Link to="/resources">Visit the resource library <ArrowRight size={17} /></Link></div>
        <div className="contact-topics"><span>Product questions</span><span>Ideas & feedback</span><span>Plans & pricing</span></div>
      </div>
      <div className="contact-form-panel">
        {status === "sent" ? <div className="contact-success" role="status"><span className="contact-success-check"><Check size={28} /></span><h2>Thanks for reaching out.</h2><p>Your message has been received. You’ve included an email address where we can reply.</p><button className="m-button m-primary" onClick={() => { setStatus("idle"); submission.current = null; }}>Send another message <ArrowRight size={17} /></button></div> : <>
          <div className="contact-form-heading"><span>WE’RE LISTENING</span><h2>Send us a message</h2><p>Share a few details so we can understand how to help.</p></div>
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (sending.current) return;
            const form = event.currentTarget;
            const fields = new FormData(form);
            const payload = { name: String(fields.get("name") || "").trim(), email: String(fields.get("email") || "").trim(), topic: String(fields.get("topic") || ""), message: String(fields.get("message") || "").trim(), website: String(fields.get("website") || "") };
            if (payload.message.length < 10) { setError("Please write at least 10 characters in your message."); setStatus("error"); return; }
            const serialized = JSON.stringify(payload);
            if (submission.current?.payload !== serialized) submission.current = { payload: serialized, id: crypto.randomUUID() };
            sending.current = true; setStatus("sending"); setError("");
            try {
              if (!supabase) throw new Error("The contact service isn’t available yet. Please try again later.");
              const result = await supabase.functions.invoke("contact-message", { body: { ...payload, id: submission.current!.id } });
              if (result.error) {
                let message = navigator.onLine
                  ? "The contact service couldn’t be reached. Please try again shortly."
                  : "You’re offline. Reconnect to the internet and send your message again.";
                const context = result.error.context;
                if (context instanceof Response) {
                  if (context.status === 404) message = "The contact service isn’t available yet. Please try again later.";
                  else if (context.status === 401 || context.status === 403) message = "The contact service isn’t available from this website yet.";
                  else if (context.status === 429) message = "Too many messages. Please try again in an hour.";
                  try {
                    const body = await context.json();
                    if (typeof body.error === "string" && !body.code) message = body.error;
                  } catch { /* Keep the status-specific message. */ }
                }
                throw new Error(message);
              }
              if (result.data?.received !== true) throw new Error("Your message wasn’t confirmed. Please try again.");
              form.reset(); setStatus("sent");
            } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to send your message."); setStatus("error"); }
            finally { sending.current = false; }
          }}>
            <fieldset disabled={status === "sending"}>
              <div className="contact-fields-row"><label>Your name<input name="name" required maxLength={100} autoComplete="name" placeholder="Your name" /></label><label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@your-business.com" /></label></div>
              <label>What can we help with?<select name="topic"><option>Product question</option><option>Product feedback</option><option>Plans & pricing</option><option>Something else</option></select></label>
              <label>Your message<textarea name="message" rows={6} required minLength={10} maxLength={3000} placeholder="Tell us a little about what you need…" /></label>
              <div className="contact-honeypot" aria-hidden="true"><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <p className="contact-privacy">Your name, email, and message are saved privately so we can respond to your enquiry. Please leave out passwords and payment details.</p>
              {error && <p className="contact-error" role="alert">{error}</p>}
              <button className="m-button m-primary contact-submit" type="submit">{status === "sending" ? <><LoaderCircle size={18} className="contact-spinner" />Sending message…</> : <>Send message <Send size={17} /></>}</button>
            </fieldset>
          </form>
        </>}
      </div>
    </section>
  </div>;
}
