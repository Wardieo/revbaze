import type { OnboardingData } from "./model";
import { ImageUpload } from "../../components/onboarding/ImageUpload";
import { uploadAccountImage } from "../../services/workspace";
export function AccountStep({
  data,
  email,
  update,
}: {
  data: OnboardingData;
  email: string;
  update: (data: OnboardingData) => void;
}) {
  return (
    <div className="stack-form onboard-fields">
      <label>
        Full name <span className="onboard-required">Required</span>
        <input
          autoComplete="name"
          required
          maxLength={100}
          value={data.name}
          onChange={(e) => update({ ...data, name: e.target.value })}
        />
      </label>
      <label>
        Email address
        <input
          type="email"
          autoComplete="email"
          value={email}
          readOnly
          aria-describedby="onboard-email-note"
        />
        <small id="onboard-email-note">Your verified account email.</small>
      </label>
      <ImageUpload
        label="Profile picture"
        value={data.avatar}
        upload={uploadAccountImage}
        onChange={(avatar) => update({ ...data, avatar })}
      />
    </div>
  );
}
