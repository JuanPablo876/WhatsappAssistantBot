import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AssistBot — AI WhatsApp Assistant for Your Business',
  description: 'Set up an AI-powered WhatsApp assistant that handles appointments, answers questions, and talks to your clients 24/7.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
