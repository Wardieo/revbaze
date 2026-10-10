import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Link2,
  Plug,
  Search,
  Settings2,
  Workflow,
  Info,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Toggle } from "../../components/ui/Toggle";
import { Dialog } from "../../components/shared/Feedback";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import { useFeedback } from "../../hooks/useFeedback";
import { useWorkspace } from "../../stores/workspace";
import { supabase } from "../../lib/supabase";
import "./integrations.css";
const apps = [
  {
    id: "zapier",
    name: "Zapier",
    category: "Automation",
    description: "Send review-link activity to a Catch Hook in your Zap.",
    instruction:
      "Create a Zap with Webhooks by Zapier → Catch Hook, then paste its URL here.",
  },
  {
    id: "make",
    name: "Make",
    category: "Automation",
    description:
      "Build visual workflows around your review cards and customer visits.",
    instruction:
      "Create a scenario with Webhooks → Custom webhook and copy its URL.",
  },
  {
    id: "n8n",
    name: "n8n",
    category: "Automation",
    description: "Route Revbaze events into your own automated workflows.",
    instruction:
      "Add a Webhook node accepting POST requests. Activate your workflow and use its production URL.",
  },
  {
    id: "webhook",
    name: "Custom webhook",
    category: "Developer tools",
    description: "Prepare an HTTPS endpoint for Revbaze event notifications.",
    instruction:
      "Enter the HTTPS endpoint you want to receive JSON event notifications.",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Notifications",
    description:
      "Keep your team informed with notifications in a Slack channel.",
    instruction: "",
    soon: true,
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "Marketing",
    description:
      "Bring your review invitation into customer follow-up campaigns.",
    instruction: "",
    soon: true,
  },
];
const eventOptions = [
  {
    id: "card.viewed",
    name: "Review card viewed",
    description: "A customer opens a public review card.",
  },
  {
    id: "link.clicked",
    name: "Review link clicked",
    description: "A customer follows an outbound platform link.",
  },
  {
    id: "card.created",
    name: "Review card created",
    description: "A new review card is saved.",
  },
  {
    id: "card.updated",
    name: "Review card updated",
    description: "An existing card is changed.",
  },
];
type Connection = {
  provider: string;
  destination_url: string;
  events: string[];
  updated_at: string;
};
export function IntegrationsPage() {
  const businessId = useWorkspace((s) => s.business?.id);
  return <IntegrationWorkspace key={businessId || "no-business"} />;
}
function IntegrationWorkspace() {
  const business = useWorkspace((s) => s.business);
  const queryClient = useQueryClient();
  const notify = useFeedback();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All integrations");
  const [selected, setSelected] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [fieldError, setFieldError] = useState("");
  const queryKey = ["integration-setup", business?.id];
  const query = useQuery({
    queryKey,
    enabled: Boolean(business?.id && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("integration_connections")
        .select("provider,destination_url,events,updated_at")
        .eq("business_id", business!.id);
      if (error)
        throw new Error(
          error.code === "42P01" || error.code === "PGRST205"
            ? "Apply migration 010 to enable integration setup."
            : error.message,
        );
      return data as Connection[];
    },
  });
  const connections = query.data || [];
  const current = apps.find((a) => a.id === selected);
  const visible = apps.filter(
    (a) =>
      (category === "All integrations" || category === a.category) &&
      `${a.name} ${a.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  function open(id: string) {
    const saved = connections.find((c) => c.provider === id);
    setStep(0);
    setFieldError("");
    setSelected(id);
    setUrl(saved?.destination_url || "");
    setEvents(saved?.events || ["link.clicked"]);
    setError("");
  }
  function validateDestination() {
    try {
      const parsed = new URL(url.trim());
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      )
        throw new Error();
      setFieldError("");
      return true;
    } catch {
      setFieldError(
        "Enter a valid HTTPS webhook URL without credentials or a fragment.",
      );
      return false;
    }
  }
  function next() {
    setError("");
    if (step === 0 && !validateDestination()) return;
    if (step === 1 && !events.length) {
      setFieldError("Choose at least one event to continue.");
      return;
    }
    setFieldError("");
    setStep(step + 1);
  }
  async function save(remove = false) {
    if (busy || !business || !supabase) return;
    if (!remove) {
      if (!validateDestination()) {
        setStep(0);
        return;
      }
      if (!events.length) {
        setStep(1);
        setFieldError("Choose at least one event.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc(
        remove ? "remove_integration_setup" : "save_integration_setup",
        {
          p_business_id: business.id,
          p_provider: selected,
          ...(!remove
            ? { p_destination_url: url.trim(), p_events: events }
            : {}),
        },
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey });
      setSelected(null);
      notify(
        remove
          ? "Integration setup removed."
          : "Integration setup saved. Event delivery is not enabled yet.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : (e as { message?: string }).message ||
              "Unable to save integration setup.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="integrations-page">
      <div className="integrations-toolbar">
        <span className="integration-demo">
          <Plug size={16} />
          Tools for your review workflow
        </span>
        <label className="integrations-search">
          <Search size={16} />
          <input
            aria-label="Search integrations"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="integration-summary">
        {[
          {
            label: "Saved setups",
            value: connections.length,
            icon: Plug,
            detail: "Configured for this business",
          },
          {
            label: "Webhook tools",
            value: 4,
            icon: Link2,
            detail: "One event format, multiple workflows",
          },
          {
            label: "Selected event subscriptions",
            value: connections.reduce((n, c) => n + c.events.length, 0),
            icon: Workflow,
            detail: "Delivery activation coming next",
          },
        ].map(({ label, value, icon: Icon, detail }) => (
          <div className="card" key={label}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </div>
      <p className="integration-setup-notice">
        <Info size={17} />
        Configure your integrations here. Automatic event delivery and provider
        authorization are not enabled yet.
      </p>
      {query.error && (
        <div className="card integration-empty" role="alert">
          {query.error.message}
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </div>
      )}
      <div
        className="integration-categories"
        role="group"
        aria-label="Integration categories"
      >
        {[
          "All integrations",
          "Automation",
          "Developer tools",
          "Notifications",
          "Marketing",
        ].map((name) => (
          <button
            key={name}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="integration-grid">
        {visible.map((app) => {
          const saved = connections.find((c) => c.provider === app.id);
          return (
            <section className="card integration-card" key={app.id}>
              <div className="integration-card-top">
                {app.id === "webhook" ? (
                  <span className="integration-app-icon">
                    <Link2 />
                  </span>
                ) : (
                  <PlatformIcon id={app.id} />
                )}
                <span
                  className={`integration-status ${saved ? "connected" : ""}`}
                >
                  {app.soon
                    ? "Coming soon"
                    : saved
                      ? "Setup saved"
                      : "Not configured"}
                </span>
              </div>
              <h2>{app.name}</h2>
              <p>{app.description}</p>
              <div className="integration-account">
                <Link2 size={13} />
                {saved
                  ? `${saved.events.length} events selected · delivery pending`
                  : app.soon
                    ? "Provider authorization coming soon"
                    : "Configure a webhook destination"}
              </div>
              <div className="integration-card-actions">
                <small>{app.category}</small>
                <Button
                  disabled={
                    app.soon ||
                    query.isPending ||
                    Boolean(query.error) ||
                    !business ||
                    !supabase
                  }
                  variant={saved ? "outline" : "primary"}
                  onClick={() => open(app.id)}
                >
                  {saved ? <Settings2 size={14} /> : <Plug size={14} />}{" "}
                  {app.soon ? "Coming soon" : saved ? "Manage" : "Set up"}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
      {!visible.length && (
        <div className="card integration-empty">
          No integrations match your search.
          <Button
            onClick={() => {
              setSearch("");
              setCategory("All integrations");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <section className="card integration-guide">
        <Workflow size={25} />
        <div>
          <h2>Review destinations belong in Review platforms</h2>
          <p>
            Google, Facebook, and Trustpilot links are managed separately from
            automation connections.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/platforms">
            Review platforms
            <ArrowRight size={14} />
          </Link>
        </Button>
      </section>
      {current && (
        <Dialog
          title={`${connections.some((c) => c.provider === current.id) ? "Manage" : "Set up"} ${current.name}`}
          close={() => {
            if (!busy) setSelected(null);
          }}
        >
          <form
            className="stack-form integration-setup-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 2) next();
              else void save();
            }}
          >
            <ol
              className="integration-steps"
              aria-label="Connection setup progress"
            >
              {["Destination", "Events", "Confirm"].map((name, index) => (
                <li
                  key={name}
                  aria-current={step === index ? "step" : undefined}
                  className={step >= index ? "active" : ""}
                >
                  <span>{index + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <div className="integration-step-body" key={step}>
              {step === 0 && (
                <>
                  <h3>Where should events go?</h3>
                  <p className="integration-dialog-detail">
                    {current.instruction}
                  </p>
                  <label htmlFor="integration-webhook-url">Webhook URL</label>
                  <input
                    id="integration-webhook-url"
                    type="url"
                    autoFocus
                    value={url}
                    disabled={busy}
                    placeholder="https://your-tool.example/webhook/…"
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby="integration-url-help integration-field-error"
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setFieldError("");
                      setError("");
                    }}
                  />
                  <small id="integration-url-help" className="muted">
                    Use your production webhook URL. Keep it private; it can
                    grant access to your workflow.
                  </small>
                </>
              )}
              {step === 1 && (
                <>
                  <h3>Choose your events</h3>
                  <p className="integration-dialog-detail">
                    Select the activity you want this workflow to receive.
                  </p>
                  <fieldset
                    className="integration-events"
                    aria-describedby="integration-field-error"
                  >
                    <legend className="sr-only">Events to subscribe to</legend>
                    {eventOptions.map((option) => (
                      <label key={option.id}>
                        <div>
                          <strong>{option.name}</strong>
                          <small>{option.description}</small>
                        </div>
                        <Toggle
                          aria-label={option.name}
                          disabled={busy}
                          checked={events.includes(option.id)}
                          onChange={(e) => {
                            setFieldError("");
                            setEvents((previous) =>
                              e.target.checked
                                ? [...previous, option.id]
                                : previous.filter((id) => id !== option.id),
                            );
                          }}
                        />
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              {step === 2 && (
                <>
                  <h3>Review your setup</h3>
                  <p className="integration-dialog-detail">
                    Save this configuration for {business?.name}.
                  </p>
                  <dl className="integration-confirm">
                    <div>
                      <dt>Integration</dt>
                      <dd>{current.name}</dd>
                    </div>
                    <div>
                      <dt>Destination</dt>
                      <dd>
                        {(() => {
                          try {
                            return new URL(url.trim()).origin + "/…";
                          } catch {
                            return "";
                          }
                        })()}
                        <small>
                          Webhook path and credentials hidden in this summary.
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>Events</dt>
                      <dd>
                        {eventOptions
                          .filter((option) => events.includes(option.id))
                          .map((option) => (
                            <span key={option.id}>{option.name}</span>
                          ))}
                      </dd>
                    </div>
                    <div>
                      <dt>Status after saving</dt>
                      <dd>Setup saved · delivery not enabled</dd>
                    </div>
                  </dl>
                </>
              )}
              {fieldError && (
                <p
                  id="integration-field-error"
                  role="alert"
                  className="error-message"
                >
                  {fieldError}
                </p>
              )}
            </div>
            <p className="integration-setup-notice">
              <Info size={16} />
              Configuration only. Automatic delivery and test requests are not
              available yet.
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {connections.some((c) => c.provider === current.id) && (
                <Button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Remove setup
                </Button>
              )}
              <Button
                type="button"
                disabled={busy}
                variant="outline"
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setFieldError("");
                    setError("");
                  }}
                >
                  Back
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : step < 2 ? "Continue" : "Save setup"}
                {!busy && step < 2 && <ArrowRight size={14} />}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
