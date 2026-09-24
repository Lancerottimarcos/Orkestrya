"use client";

import { useEffect } from "react";
import { Home, RotateCcw } from "lucide-react";
import { Geist, Geist_Mono } from "next/font/google";
import { Logo } from "@/components/layout/Logo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-app-glow">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-danger/10 blur-[130px]" />
          </div>

          <div className="relative z-10 w-full max-w-md text-center flex flex-col items-center">
            <Logo />

            <p className="mt-12 text-[96px] sm:text-[120px] font-light tracking-tight leading-none text-ink">Ops</p>
            <h1 className="mt-5 text-lg font-semibold text-ink">Algo deu muito errado</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed max-w-sm">
              O aplicativo encontrou um erro grave. Tente recarregar a página.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => unstable_retry()}
                className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors cursor-pointer px-6 py-3 text-sm bg-transparent text-ink border border-border-2 hover:border-accent hover:text-accent"
              >
                <RotateCcw size={15} /> Tentar novamente
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors cursor-pointer px-6 py-3 text-sm bg-accent text-black hover:bg-accent-light"
              >
                <Home size={15} /> Início
              </a>
            </div>

            {error.digest && (
              <p className="mt-8 text-[11px] text-muted-2 font-mono">Código: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
