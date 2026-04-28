import type { Metadata } from 'next';
import { Syne, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import '../styles/globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Transmux — Media Converter',
  description: 'Convert audio and video with FFmpeg. Fast, free, and self-hosted.',
  keywords: ['media converter', 'ffmpeg', 'audio converter', 'video converter', 'youtube downloader'],
  authors: [{ name: 'Transmux' }],
  openGraph: {
    title: 'Transmux — Media Converter',
    description: 'Convert audio and video. Drop a file or paste a URL.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${jetbrains.variable}`}>
      <body className="relative min-h-screen overflow-x-hidden">
        <div className="noise-overlay" />
        <div className="relative z-10">
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                border: '1px solid var(--brd)',
                color: 'var(--tx)',
                fontFamily: 'var(--font-syne)',
              },
            }}
          />
        </div>
      </body>
    </html>
  );
}