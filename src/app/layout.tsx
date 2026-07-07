import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Divulga Top — Melhores Ofertas",
  description: "Ofertas de Mercado Livre, Amazon e Shopee em um só lugar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
