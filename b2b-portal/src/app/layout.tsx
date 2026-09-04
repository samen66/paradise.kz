import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Paradise B2B — Оптовый портал",
    template: "%s | Paradise B2B",
  },
  description: "Оптовый портал Paradise. Заказывайте мебель напрямую со склада по оптовым ценам.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-surface font-sans antialiased text-ink min-h-screen" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
