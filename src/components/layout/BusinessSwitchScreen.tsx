import { BrandLogo } from "../shared/BrandLogo";
import { LoaderCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";
import "./business-switch.css";
export function BusinessSwitchScreen({
  name,
  logo,
  error,
  retry,
  cancel,
}: {
  name: string;
  logo: string;
  error: string;
  retry: () => void;
  cancel: () => void;
}) {
  return (
    <div className="business-switch-screen" aria-busy={!error}>
      <span className="business-switch-brand">
        <BrandLogo />
      </span>
      <div className="business-switch-content">
        <div className="business-switch-mark">
          {logo ? (
            <img src={logo} alt={`${name} logo`} />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <h1>{error ? "Unable to switch workspace" : `Opening ${name}`}</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <div className="business-switch-actions">
              <Button onClick={cancel}>
                <ArrowLeft size={15} />
                Go back
              </Button>
              <Button variant="primary" onClick={retry}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </>
        ) : (
          <>
            <p role="status">Loading your business workspace…</p>
            <LoaderCircle className="business-switch-spinner" size={24} />
            <div className="business-switch-progress" aria-hidden="true">
              <span />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
