import "./globals.css";

export const metadata = {
  title: "Stint — Job Application Tracker",
  description:
    "A clean, minimal job and internship application tracker for CS students. Track every application, log interviews, and see your search at a glance.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">
        {children}
      </body>
    </html>
  );
}