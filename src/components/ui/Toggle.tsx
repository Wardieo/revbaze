import type { InputHTMLAttributes } from "react";
import "./toggle.css";
/** Native keyboard and form behavior, presented as an accessible switch. */
export function Toggle({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">) {
  return (
    <span className={`ui-toggle ${className}`}>
      <input {...props} type="checkbox" role="switch" />
      <span className="ui-toggle-track" aria-hidden="true">
        <span className="ui-toggle-thumb" />
      </span>
    </span>
  );
}
