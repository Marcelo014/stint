"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "./ThemeProvider";

/**
 * Clerk's appearance config needs literal colours — it derives hover and
 * disabled shades from them, so handing it `var(--color-accent)` would break
 * those derivations. The two palettes below are therefore copies of the
 * @theme and .dark blocks in globals.css and must be kept in step with them.
 *
 * `elements` is shared: those are Tailwind classes using our own tokens, so
 * they already follow the theme on their own.
 *
 * This is a client component, which means ClerkProvider resolves to Clerk's
 * client build rather than its server one. That is equivalent here: the server
 * build only fetches server-side auth state when it's given the `dynamic`
 * prop, and both builds otherwise render the same ClientClerkProvider with the
 * same env merge. If `dynamic` is ever needed, ClerkProvider has to move back
 * into the server layout and the theme reach it some other way.
 */
const VARIABLES = {
  light: {
    colorPrimary: "#7a8c5e",
    colorBackground: "#fbf6ed",
    colorText: "#2c2a26",
    colorTextSecondary: "#6b6359",
    colorInputBackground: "#f5efe6",
    colorInputText: "#2c2a26",
    colorNeutral: "#2c2a26",
    colorDanger: "#c25450",
    colorSuccess: "#5ba84a",
    colorWarning: "#d4a72c",
  },
  dark: {
    colorPrimary: "#9aae7a",
    colorBackground: "#2a2620",
    colorText: "#f0e9dd",
    colorTextSecondary: "#b8ad9d",
    colorInputBackground: "#1f1c17",
    colorInputText: "#f0e9dd",
    colorNeutral: "#f0e9dd",
    colorDanger: "#d26460",
    colorSuccess: "#6bb85a",
    colorWarning: "#e0b541",
  },
};

const SHARED_VARIABLES = {
  borderRadius: "0.5rem",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const ELEMENTS = {
  rootBox: "w-full",
  card: "shadow-none border border-border bg-card",
  headerTitle: "text-text",
  headerSubtitle: "text-text-muted",
  socialButtonsBlockButton:
    "border-border bg-card hover:bg-card-hover transition text-text",
  socialButtonsBlockButtonText: "text-text font-medium",
  dividerLine: "bg-border",
  dividerText: "text-text-subtle",
  formFieldLabel: "text-text",
  formFieldInput: "border-border bg-bg text-text",
  formButtonPrimary:
    "bg-accent hover:bg-accent-hover text-accent-fg normal-case font-medium transition",
  footerActionText: "text-text-muted",
  footerActionLink: "text-accent hover:text-accent-hover font-medium",
  identityPreviewText: "text-text",
  identityPreviewEditButton: "text-accent hover:text-accent-hover",
  formFieldInputShowPasswordButton: "text-text-muted hover:text-text",
  otpCodeFieldInput: "border-border bg-bg text-text",
  formResendCodeLink: "text-accent hover:text-accent-hover",
};

export default function ClerkThemeProvider({ children }) {
  const { resolved } = useTheme();

  const appearance = {
    variables: { ...SHARED_VARIABLES, ...VARIABLES[resolved] },
    elements: ELEMENTS,
  };

  return (
    <ClerkProvider appearance={appearance} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}
