import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]";

    const variantStyles = {
      primary:
        "primary-gradient",
      secondary:
        "bg-subtle text-primary-text border border-border hover:bg-white hover:border-accent/35",
      outline:
        "border border-border bg-white/70 text-primary-text hover:bg-white hover:border-accent/35",
      ghost:
        "text-secondary-text hover:text-primary-text hover:bg-subtle active:bg-border/40",
      danger:
        "bg-danger text-white hover:bg-red-700 shadow-sm active:translate-y-[0.5px]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-[12px] rounded-full gap-1.5",
      md: "h-10 px-4 text-[13px] rounded-full gap-2",
      lg: "h-12 px-5 text-[14px] rounded-full gap-2.5",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
