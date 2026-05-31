import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-sage text-white hover:bg-[#3d5a4e] disabled:opacity-50",
  secondary: "bg-neutral-100 text-ink hover:bg-neutral-200 disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-neutral-100 disabled:opacity-50",
  danger: "bg-attention text-white hover:bg-[#a04f3f] disabled:opacity-50",
  outline: "border border-neutral-300 bg-surface text-ink hover:bg-neutral-50 disabled:opacity-50",
};

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-base font-medium transition-colors duration-150 ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
