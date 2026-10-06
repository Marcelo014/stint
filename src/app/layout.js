import { auth } from "@clerk/nextjs/server";
import { readThemePreference } from "@/lib/profile";
import ClerkThemeProvider from "@/app/components/theme/ClerkThemeProvider";
import ThemeProvider from "@/app/components/theme/ThemeProvider";
import ThemeScript from "@/app/components/theme/ThemeScript";
import "./globals.css";

export const metadata = {
  title: "Stint — Job Application Tracker",
  description:
    "A clean, minimal job and internship application tracker for CS students. Track every application, log interviews, and see your search at a glance.",
};

export default async function RootLayout({ children }) {
  // The stored preference is read here, not in a client fetch, so the inline
  // script below can set the theme before the first paint on a browser that
  // has never seen this user.
  const { userId } = await auth();
  const themePreference = await readThemePreference(userId);

  return (
    // ThemeScript mutates <html>'s class and style before React hydrates,
    // which is exactly the mismatch suppressHydrationWarning is for.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript preference={themePreference} />
      </head>
      <body className="min-h-screen bg-bg text-text antialiased">
        <ThemeProvider serverPreference={themePreference}>
          <ClerkThemeProvider>{children}</ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
