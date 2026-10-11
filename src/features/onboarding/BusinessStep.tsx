import type { OnboardingData } from "./model";
import { ImageUpload } from "../../components/onboarding/ImageUpload";
import { uploadImage } from "../../services/workspace";
import { validateDestination } from "../../lib/validation";
import { useState } from "react";
import { businessCategories as categories } from "../../lib/platforms";
export function BusinessStep({
  data,
  update,
  save,
}: {
  data: OnboardingData;
  update: (data: OnboardingData) => void;
  save: () => Promise<unknown>;
}) {
  const [touched, setTouched] = useState(false);
  let websiteError = "";
  if (data.business.website_url) {
    try {
      validateDestination(data.business.website_url);
    } catch (err) {
      websiteError = (err as Error).message;
    }
  }
  const field = (key: string, value: string) =>
    update({ ...data, business: { ...data.business, [key]: value } });
  return (
    <div className="stack-form onboard-fields">
      <label>
        Business name <span className="onboard-required">Required</span>
        <input
          required
          maxLength={100}
          autoComplete="organization"
          placeholder="e.g. Studio North"
          value={data.business.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </label>
      <label>
        Business category <span className="onboard-required">Required</span>
        <select
          required
          value={data.business.category}
          onChange={(e) => field("category", e.target.value)}
        >
          <option value="" disabled>
            Choose a business category
          </option>
          {data.business.category &&
            !categories.includes(data.business.category) && (
              <option value={data.business.category}>
                {data.business.category}
              </option>
            )}
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label>
        Website <span className="onboard-required">Optional</span>
        <input
          type="url"
          placeholder="https://your-business.com"
          value={data.business.website_url}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && Boolean(websiteError)}
          aria-describedby={
            touched && websiteError ? "onboard-website-error" : undefined
          }
          onChange={(e) => field("website_url", e.target.value)}
        />
        {touched && websiteError && (
          <span id="onboard-website-error" className="onboard-inline-error">
            {websiteError}
          </span>
        )}
      </label>
      <label>
        Business description <span className="onboard-required">Optional</span>
        <textarea
          maxLength={1000}
          rows={3}
          placeholder="A little about what you do…"
          value={data.business.description}
          onChange={(e) => field("description", e.target.value)}
        />
      </label>
      <ImageUpload
        label="Business logo"
        value={data.business.logo_url}
        disabled={
          !data.business.name.trim() ||
          !data.business.category.trim() ||
          Boolean(websiteError)
        }
        upload={async (file) => {
          await save();
          return uploadImage(file, data.business.id);
        }}
        onChange={(logo_url) => field("logo_url", logo_url)}
      />
    </div>
  );
}
