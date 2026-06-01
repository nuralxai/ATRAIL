import "./globals.css";
import { ToastViewport } from "../components/ui/toast";
import { ConfirmHost } from "../components/ui/confirm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ATRAIL | Enterprise Workflow",
  description: "Secure, Scalable, and Lightning Fast Enterprise Management",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full text-zinc-200 font-sans antialiased">
        {children}
        <ToastViewport />
        <ConfirmHost />
      </body>
    </html>
  );
}
