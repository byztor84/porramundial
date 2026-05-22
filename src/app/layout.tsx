import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Porra del Mundial 2026",
  description: "Plataforma de predicciones del Mundial FIFA 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
