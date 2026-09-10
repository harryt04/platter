import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ToastProvider } from '@/components/providers/toast-provider'
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration'

const instrument = localFont({
  src: './fonts/instrument-sans.woff2',
  variable: '--font-instrument',
})
const fraunces = localFont({
  src: './fonts/fraunces.woff2',
  variable: '--font-fraunces',
})
const dmMono = localFont({
  src: './fonts/dm-mono.woff2',
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: { default: 'Platter', template: '%s · Platter' },
  description: 'A trustworthy shared recipe-to-grocery list.',
  applicationName: 'Platter',
  manifest: '/manifest.webmanifest',
}
export const viewport: Viewport = {
  themeColor: '#0057D9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrument.variable} ${fraunces.variable} ${dmMono.variable}`}
    >
      <body>
        <ThemeProvider>
          <ToastProvider />
          <ServiceWorkerRegistration />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
