import type { Metadata } from 'next';
import { Syne, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import '../styles/globals.css';
import ThemeProvider from '@/components/layout/ThemeProvider';

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
  description: 'Convert audio, video and subtitles with FFmpeg. Self-hosted, open source.',
  keywords: ['media converter', 'ffmpeg', 'audio converter', 'video converter', 'open source'],
  authors: [{ name: 'Transmux' }],
  openGraph: {
    title: 'Transmux — Media Converter',
    description: 'Convert audio, video and subtitles. Drop a file or paste a URL.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}