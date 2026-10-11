import { Check, LoaderCircle } from "lucide-react";
import "./slug-status.css";
export function SlugStatus({
  available,
  message,
}: {
  available: boolean;
  message: string;
}) {
  return available ? (
    <Check
      className="slug-status available"
      size={18}
      role="img"
      aria-label="URL available"
    />
  ) : message === "Checking availability…" ? (
    <LoaderCircle
      className="slug-status checking"
      size={18}
      role="img"
      aria-label="Checking URL availability"
    />
  ) : null;
}
