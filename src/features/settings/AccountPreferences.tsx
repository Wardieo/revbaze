import { Toggle } from "../../components/ui/Toggle";
import { uploadAccountImage } from "../../services/workspace";
import { useState } from "react";
import { Check, Moon, Sun, Monitor } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { usePreferences } from "../../stores/preferences";
import { Button } from "../../components/ui/Button";
import { useFeedback } from "../../hooks/useFeedback";
export function AccountPreferences({
  tab,
}: {
  tab: "profile" | "preferences" | "notifications";
}) {
  const preferences = usePreferences();
  const notify = useFeedback();
  const [name, setName] = useState(preferences.name);
  const [email, setEmail] = useState(preferences.email);
  const [image, setImage] = useState(preferences.image);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  return (
    <>
      <div className={`settings-grid account-section-${tab}`}>
        <section className="card padded">
          <h2>Your account</h2>
          <p className="section-description">
            Keep your profile and sign-in details up to date.
          </p>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const savedImage = imageFile
                  ? await uploadAccountImage(imageFile)
                  : image;
                if (supabase) {
                  const { error } = await supabase.auth.updateUser({
                    data: { name, avatar_url: savedImage },
                    ...(email !== preferences.email ? { email } : {}),
                  });
                  if (error) throw error;
                  notify(
                    "Account saved. Email changes may require confirmation.",
                  );
                } else {
                  notify("Profile saved on this browser.");
                }
                preferences.set({
                  name,
                  email: supabase ? preferences.email : email,
                  image: savedImage,
                });
                setImage(savedImage);
                setImageFile(null);
              } catch (err) {
                notify(
                  err instanceof Error
                    ? err.message
                    : "Unable to update account.",
                  true,
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="account-image-field">
              {image ? (
                <img className="avatar" src={image} alt="Your profile" />
              ) : (
                <span className="avatar profile-avatar">
                  {name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <label>
                Profile image
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (
                      file.size >= 10 * 1024 * 1024 ||
                      !["image/png", "image/jpeg"].includes(file.type)
                    ) {
                      notify(
                        "Choose a PNG, JPG, or JPEG under 10 MB for your account image.",
                        true,
                      );
                      return;
                    }
                    setImageFile(file);
                    const reader = new FileReader();
                    reader.onload = () => setImage(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {image && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setImage("");
                    setImageFile(null);
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            <label>
              Name
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required={Boolean(supabase)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@your-business.com"
              />
            </label>
            {!supabase && (
              <small className="form-help">
                Local workspace mode. Account authentication is enabled when
                Supabase is configured.
              </small>
            )}
            <Button variant="primary" type="submit" disabled={saving}>
              <Check size={14} />
              {saving ? "Saving…" : "Save account"}
            </Button>
          </form>
        </section>
        <div>
          <section className="card padded">
            <h2>Appearance</h2>
            <p className="section-description">
              Choose a view that feels right.
            </p>
            <div className="theme-options">
              {[
                { id: "light" as const, label: "Light", icon: Sun },
                { id: "dark" as const, label: "Dark", icon: Moon },
                { id: "system" as const, label: "System", icon: Monitor },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={preferences.theme === id ? "selected" : ""}
                  aria-pressed={preferences.theme === id}
                  onClick={() => preferences.set({ theme: id })}
                >
                  <Icon size={19} />
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section className="card padded">
            <h2>Notifications</h2>
            <p className="section-description">
              Preferences for future notifications. No messages are sent in this
              phase.
            </p>
            <label className="setting-row">
              <span>Product updates</span>
              <Toggle
                checked={preferences.product_notifications}
                onChange={async (e) => {
                  const value = e.target.checked;
                  try {
                    if (supabase) {
                      const { error } = await supabase.auth.updateUser({
                        data: { product_notifications: value },
                      });
                      if (error) throw error;
                    }
                    preferences.set({ product_notifications: value });
                    notify("Notification preference saved.");
                  } catch (err) {
                    notify(
                      err instanceof Error ? err.message : "Unable to save.",
                      true,
                    );
                  }
                }}
              />
            </label>
            <label className="setting-row">
              <span>Workspace activity</span>
              <Toggle
                checked={preferences.activity_notifications}
                onChange={async (e) => {
                  const value = e.target.checked;
                  try {
                    if (supabase) {
                      const { error } = await supabase.auth.updateUser({
                        data: { activity_notifications: value },
                      });
                      if (error) throw error;
                    }
                    preferences.set({ activity_notifications: value });
                    notify("Notification preference saved.");
                  } catch (err) {
                    notify(
                      err instanceof Error ? err.message : "Unable to save.",
                      true,
                    );
                  }
                }}
              />
            </label>
          </section>
        </div>
      </div>
    </>
  );
}
