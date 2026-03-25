import React from "react";
import type { Metadata, Viewport } from "next";
import { Providers } from "../context/Providers"
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ThemeColorMeta } from "../components/ThemeColorMeta";

export const metadata: Metadata = {
  title: "Powers Protocol",
  description: "UI to interact with organisations using the Powers Protocol.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  
  return (
    <html suppressHydrationWarning lang="en">
      <head />
     
      <body className="h-dvh w-screen relative bg-background overflow-hidden">
        <ThemeProvider attribute="class">
          <ThemeColorMeta />
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
