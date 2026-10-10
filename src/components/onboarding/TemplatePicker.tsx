import "./TemplatePicker.css";
import type { CardTemplate } from "../../types/workspace";
const templates: { id: CardTemplate; name: string; description: string }[] = [
  {
    id: "classic",
    name: "Centered",
    description: "A familiar, balanced layout",
  },
  {
    id: "left",
    name: "Editorial",
    description: "Identity and content aligned left",
  },
  {
    id: "split",
    name: "Spotlight",
    description: "Brand beside your invitation",
  },
  {
    id: "grid",
    name: "Platform grid",
    description: "Destinations side by side",
  },
];
export function TemplatePicker({
  value,
  onChange,
}: {
  value: CardTemplate;
  onChange: (template: CardTemplate) => void;
}) {
  return (
    <div className="onboard-template-field">
      <span className="onboard-field-label">Card layout</span>
      <div
        className="onboard-templates"
        role="group"
        aria-label="Card layout templates"
      >
        {templates.map((t) => (
          <button
            type="button"
            key={t.id}
            aria-pressed={value === t.id}
            onClick={() => onChange(t.id)}
          >
            <span
              className={`template-thumbnail template-thumbnail-${t.id}`}
              aria-hidden="true"
            >
              <i className="thumbnail-logo" />
              <i className="thumbnail-title" />
              <i className="thumbnail-copy" />
              <span className="thumbnail-buttons">
                <i />
                <i />
                <i />
              </span>
            </span>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
