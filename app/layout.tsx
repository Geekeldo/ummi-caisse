// app/layout.tsx
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'UMMI — Gestion',
  description: 'Système de gestion de caisse, stock et équipe',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'UMMI',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1D2D2B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* PWA iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="UMMI" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        {/* PWA Android / Windows */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />
        <meta name="msapplication-TileColor" content="#1D2D2B" />
      </head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
