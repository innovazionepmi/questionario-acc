import type { Metadata } from "next";
import { Lora, Poppins } from "next/font/google";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Il tuo questionario | InnovazionePMI",
  description: "Un percorso guidato per capire dove l'AI può davvero aiutare la tua azienda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${lora.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ivory text-navy">{children}</body>
    </html>
  );
}
