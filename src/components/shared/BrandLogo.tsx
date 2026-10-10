import logo from "../../assets/logo-whitebg.jpeg";
import darkLogo from "../../assets/logo-bluebg.jpeg";
import "./brand-logo.css";
export function BrandLogo({
  variant = "adaptive",
}: {
  variant?: "adaptive" | "blue";
}) {
  return (
    <span className="revbaze-brand-logo">
      {variant === "blue" ? (
        <img src={darkLogo} width={40} height={40} alt="" decoding="async" />
      ) : (
        <>
          <img
            className="brand-logo-light"
            src={logo}
            width={40}
            height={40}
            alt=""
            decoding="async"
          />
          <img
            className="brand-logo-dark"
            src={darkLogo}
            width={40}
            height={40}
            alt=""
            decoding="async"
          />
        </>
      )}
      <span>
        revbaze<span className="revbaze-brand-dot">.</span>
      </span>
    </span>
  );
}
