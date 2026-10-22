import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Middag — litt enklere hver dag",
  description:
    "Planlegg glutenfrie middager for hele uken og få handlelisten ferdig på et øyeblikk.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
