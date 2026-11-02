import { Links, Meta, Outlet, Scripts, ScrollRestoration, json, useLoaderData } from '@remix-run/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Toaster } from '~/components/ui/sonner'
import './tailwind.css'
import GeminiAssistant from '~/components/GeminiAssistant'
import { Toaster as ShadToaster } from '~/components/ui/toaster'
import useAuthStore from '~/store/authStore'

declare global {
  interface Window {
    ENV: {
      USE_LOCAL_STORAGE: boolean
    }
  }
}

export async function loader() {
  return json({
    ENV: {
      USE_LOCAL_STORAGE: process.env.USE_LOCAL_STORAGE === 'true',
    },
  })
}

export default function App() {
  const data = useLoaderData<typeof loader>()
  const user = useAuthStore((s) => s.user)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 24, // 1 day
            staleTime: 1000 * 60 * 60, // 1 hour
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: That's how we pass the ENV to the client
            dangerouslySetInnerHTML={{
              __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
            }}
          />
          <ScrollRestoration />
          <Scripts />
          <Toaster duration={1000} />
          <ShadToaster />
          {mounted && user ? <GeminiAssistant /> : null}
        </QueryClientProvider>
      </body>
    </html>
  )
}
