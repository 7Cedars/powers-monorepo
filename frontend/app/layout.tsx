import React from "react";
import type { Metadata, Viewport } from "next";
import { Providers } from "../context/Providers"
import "./globals.css";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "Powers Protocol",
  description: "UI to interact with organisations using the Powers Protocol.",
};

export const viewport: Viewport = {
  themeColor: "#475569",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  
  return (
    <html suppressHydrationWarning lang="en">
      <head />
     
      <body className="h-dvh w-screen relative bg-slate-100 overflow-hidden">
        <ThemeProvider attribute="class">
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
