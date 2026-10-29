import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "mcaisse · Suivi commercial",
  description: "Suivi des dossiers commerciaux mcaisse, partagé en direct avec l'équipe.",
  applicationName: "mcaisse",
  appleWebApp: {
    capable: true,
    title: "mcaisse",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Même couleur que le fond de l'app : la barre du navigateur se fond dans l'écran
  themeColor: "#f3f4f8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
