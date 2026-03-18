import type { Metadata } from "next";
// import { Inter } from 'next/font/google';
import "./globals.css";
import { LauncherAuthProvider } from '@dtf/contexts/LauncherAuthContext";
import { WidgetProvider } from '@dtf/contexts/WidgetContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Gerador DTF - Overpixel Studio",
  description: "Gerador de imagens DTF com IA - Halftone automático e salvamento local",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased bg-black text-white`}>
        <LauncherAuthProvider>
          <WidgetProvider>
            {children}
          </WidgetProvider>
        </LauncherAuthProvider>
      </body>
    </html>
  );
}
