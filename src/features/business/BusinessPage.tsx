import { businessCategories } from "../../lib/platforms";
import { useWorkspaceRole } from "../../hooks/useWorkspaceRole";
import { useState } from "react";
import { Upload, Check, Building2 } from "lucide-react";
import { useWorkspace } from "../../stores/workspace";
import { Button } from "../../components/ui/Button";
import { PageHeading } from "../../components/shared/Feedback";
import { useFeedback } from "../../hooks/useFeedback";
import { uploadImage } from "../../services/workspace";
import { slugify } from "../../lib/validation";
import type { Business } from "../../types/workspace";
export function BusinessForm({ onSaved }: { onSaved?: () => void }) {
  const permissions = useWorkspaceRole();
  const { business, busy, saveBusiness } = useWorkspace();
  const notify = useFeedback();
  const [draft, setDraft] = useState<Business>(() =>
    business
      ? { ...business }
      : {
          id: crypto.randomUUID(),
          name: "",
          slug: "",
          category: "Software & technology",
          description: "",
          logo_url: "",
          website_url: "",
          contact_email: "",
          brand_color: "#042751",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  function update(values: Partial<Business>) {
    setDraft({ ...draft, ...values });
    setError("");
  }
  if (!permissions.canManageBusiness)
    return (
      <p className="form-help">
        Only the owner and admins can edit business settings.
      </p>
    );
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
          await saveBusiness({ ...draft, name: draft.name.trim() });
          if (file) {
            const logo = await uploadImage(file, draft.id);
            await saveBusiness({
              ...draft,
              name: draft.name.trim(),
              logo_url: logo,
            });
            setDraft((d) => ({ ...d, logo_url: logo }));
            setFile(null);
          }
          notify("Business profile saved.");
          onSaved?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to save.");
        } finally {
          setUploading(false);
        }
      }}
    >
      <div className="business-form-heading">
        <span className="business-form-avatar">
          {preview || draft.logo_url ? (
            <img src={preview || draft.logo_url} alt="Business logo" />
          ) : (
            <Building2 size={28} />
          )}
        </span>
        <div>
          <strong>Your business logo</strong>
          <p>PNG, JPG, or JPEG. Under 10 MB.</p>
          <label className="file-upload">
            <Upload size={13} />
            Choose image
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (!next) return;
                if (
                  !["image/png", "image/jpeg"].includes(next.type) ||
                  next.size > 10 * 1024 * 1024
                ) {
                  setError("Choose a PNG, JPG, or JPEG image under 10 MB.");
                  return;
                }
                setFile(next);
                const reader = new FileReader();
                reader.onload = () => setPreview(String(reader.result));
                reader.readAsDataURL(next);
              }}
            />
          </label>
          {(draft.logo_url || preview) && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setFile(null);
                setPreview("");
                update({ logo_url: "" });
              }}
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
      <div className="form-columns">
        <label>
          Business name
          <input
            required
            maxLength={100}
            value={draft.name}
            placeholder="Acme Studio"
            onChange={(e) => {
              const name = e.target.value;
              update({
                name,
                ...(!business &&
                (!draft.slug || draft.slug === slugify(draft.name))
                  ? { slug: slugify(name) }
                  : {}),
              });
            }}
          />
        </label>
        <label>
          Business category
          <select
            value={draft.category}
            onChange={(e) => update({ category: e.target.value })}
          >
            {businessCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Business slug
        <input
          required
          value={draft.slug}
          maxLength={60}
          placeholder="acme-studio"
          onChange={(e) => update({ slug: e.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          maxLength={1000}
          value={draft.description}
          placeholder="A little about what you do…"
          onChange={(e) => update({ description: e.target.value })}
        />
      </label>
      <div className="form-columns">
        <label>
          Website <span className="optional">optional</span>
          <input
            type="url"
            value={draft.website_url}
            placeholder="https://your-business.com"
            onChange={(e) => update({ website_url: e.target.value })}
          />
        </label>
        <label>
          Contact email
          <input
            type="email"
            value={draft.contact_email}
            placeholder="hello@your-business.com"
            onChange={(e) => update({ contact_email: e.target.value })}
          />
        </label>
      </div>
      <label>
        Brand accent color
        <div className="color-input">
          <input
            type="color"
            value={draft.brand_color}
            onChange={(e) => update({ brand_color: e.target.value })}
          />
          <span>{draft.brand_color}</span>
        </div>
      </label>
      <small className="form-help">
        New cards inherit this branding. Existing cards keep their own
        appearance settings.
      </small>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button variant="primary" type="submit" disabled={busy || uploading}>
        <Check size={15} />
        {busy || uploading
          ? "Saving…"
          : onSaved
            ? "Save & continue"
            : "Save business profile"}
      </Button>
    </form>
  );
}
export function BusinessPage() {
  return (
    <>
      <PageHeading
        title="The business behind the invitation"
        description="A familiar name, a recognizable face, and a little about what you do."
      />
      <section className="card business-profile-card">
        <BusinessForm />
      </section>
    </>
  );
}
