import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function Button({
  className,
  variant = "outline",
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "primary" | "ghost";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={twMerge(
        clsx(
          "button",
          variant === "outline" ? "button-outline" : variant,
          className,
        ),
      )}
      {...props}
    />
  );
}
