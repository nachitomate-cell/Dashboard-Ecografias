import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ExportButton from "@/components/ExportButton";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Dashboard · Tecnólogo Médico",
  description: "Dashboard financiero para tecnólogo médico en ecografía",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="flex h-screen overflow-hidden bg-slate-950">
        <AppShell>
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-slate-950 bg-mesh">
            <div className="page-enter">
              {children}
            </div>
          </main>
          <ExportButton />
        </AppShell>
      </body>
    </html>
  );
}
