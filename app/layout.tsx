import type { Metadata } from "next";
import { Manrope, Fraunces } from "next/font/google";
import "@/app/globals.css";
import { Providers } from "@/components/providers";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Himalaya Paints Dashboard",
  description: "Role-based admin and user dashboard with live calculations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} font-sans antialiased`}>
        <Providers />
        {children}
      </body>
    </html>
  );
}
