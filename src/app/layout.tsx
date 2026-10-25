import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';

export const metadata: Metadata = {
  title: 'CodeGuard AI — Autonomous GitHub PR & Codebase Security Auditor',
  description:
    'Free-of-cost autonomous GitHub PR & codebase security auditor powered by pgvector, Google Gemini 2.5 Flash, and Next.js 15.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
