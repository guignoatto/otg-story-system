import { useState, type ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  value?: string | number | null;
  required?: boolean;
  touched?: boolean;
  disabled?: boolean;
  className?: string;
};

export function FormField({ label, children, value, required = false, touched = false, disabled = false, className = "" }: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const isFilled = value !== undefined && value !== null && String(value).trim() !== "";
  const isError = required && touched && !isFilled && !disabled;
  const classes = [
    "field-control",
    focused ? "is-focused" : "",
    isFilled ? "is-filled" : "",
    isError ? "is-error" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {label}
      {children}
    </label>
  );
}
