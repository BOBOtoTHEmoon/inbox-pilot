import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InboxPilot — Instagram DM Automation',
  description: 'Automate your Instagram DMs, convert comments to conversations, and manage your inbox like a pro.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}
