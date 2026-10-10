import "./ImageUpload.css";
import { useEffect, useId, useRef, useState } from "react";
import { validateImage } from "../../lib/images";
import { Upload, LoaderCircle, X } from "lucide-react";
export function ImageUpload({
  label,
  value,
  upload,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  upload: (file: File) => Promise<string>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  async function pick(file?: File) {
    if (!file || busy || disabled) return;
    setError("");
    try {
      validateImage(file);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setBusy(true);
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      changeRef.current(await upload(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    } finally {
      setPreview("");
      URL.revokeObjectURL(local);
      setBusy(false);
    }
  }
  return (
    <div className="onboard-upload-field">
      <span className="onboard-field-label">
        {label} <small>Optional</small>
      </span>
      <div
        className={`onboard-upload ${over ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void pick(e.dataTransfer.files[0]);
        }}
      >
        {preview || value ? (
          <img src={preview || value} alt={label} />
        ) : (
          <Upload size={22} />
        )}
        <div>
          <label htmlFor={id}>
            {busy ? "Uploading…" : "Choose an image"}
            <input
              id={id}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              disabled={busy || disabled}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <small>
            {disabled
              ? "Enter your business name and category first."
              : "or drag and drop · PNG, JPG, JPEG · under 10 MB"}
          </small>
        </div>
        {busy ? (
          <LoaderCircle className="onboard-spinner" size={18} />
        ) : (
          value && (
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={() => onChange("")}
            >
              <X size={15} />
            </button>
          )
        )}
      </div>
      {error && (
        <p className="onboard-inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
