"use client";
import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md";
};

export default function Button({
  className,
  variant = "outline",
  size = "md",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md transition active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-transparent";
  const sizes = {
    sm: "px-2.5 py-1.5 text-sm",
    md: "px-3.5 py-2 text-sm",
  };
  const variants = {
    solid:
      "bg-ink text-white border border-transparent hover:opacity-95 dark:bg-white dark:text-black",
    outline:
      "border border-line bg-white/70 hover:bg-white/90 dark:bg-transparent dark:hover:bg-white/10",
    ghost:
      "border-transparent hover:bg-black/5 dark:hover:bg-white/10",
  };
  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}
