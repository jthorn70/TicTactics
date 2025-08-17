import "./globals.css";
import { Inter } from "next/font/google";
import NavBar from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = { title: "TicTactics", description: "Head-to-head board strategy" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-paper text-ink antialiased min-h-dvh">
        <div className="mx-auto max-w-screen-sm px-4">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
