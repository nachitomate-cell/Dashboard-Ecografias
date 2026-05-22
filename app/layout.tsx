import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Dashboard · Tecnólogo Médico",
  description: "Dashboard financiero para tecnólogo médico en ecografía",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="bg-slate-950">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
