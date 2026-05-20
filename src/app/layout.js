import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  title: "Stint — Job Application Tracker",
  description:
    "A clean, minimal job and internship application tracker for CS students. Track every application, log interviews, and see your search at a glance.",
};

const clerkAppearance = {
  variables: {
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
    borderRadius: "0.5rem",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  elements: {
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
      "bg-accent hover:bg-accent-hover text-card normal-case font-medium transition",
    footerActionText: "text-text-muted",
    footerActionLink: "text-accent hover:text-accent-hover font-medium",
    identityPreviewText: "text-text",
    identityPreviewEditButton: "text-accent hover:text-accent-hover",
    formFieldInputShowPasswordButton: "text-text-muted hover:text-text",
    otpCodeFieldInput: "border-border bg-bg text-text",
    formResendCodeLink: "text-accent hover:text-accent-hover",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <html lang="en">
        <body className="min-h-screen bg-bg text-text antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}