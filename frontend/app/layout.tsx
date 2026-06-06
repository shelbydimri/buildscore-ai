import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BuildScore AI | Validate Your Startup Idea',
  description: 'AI-powered startup idea validation and analysis. Define, research, strategize, critique, and decide with confidence.',
  viewport: 'width=device-width, initial-scale=1',
  charset: 'utf-8',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-slate-50 to-slate-100">
        {children}
      </body>
    </html>
  );
}
