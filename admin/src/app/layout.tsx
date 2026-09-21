import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthInitializer from "@/components/AuthInitializer";
import ProtectedRoute from "@/components/ProtectedRoute";
import Toaster from "@/components/ui/Toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paradise Admin",
  description: "Админ-панель Paradise.kz",
};

/**
 * `viewportFit: 'cover'` включает `env(safe-area-inset-*)` — без него
 * нижняя панель и шторки не знают про «домашнюю полоску» iPhone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafafa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthInitializer>
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </AuthInitializer>
        <Toaster />
      </body>
    </html>
  );
}
