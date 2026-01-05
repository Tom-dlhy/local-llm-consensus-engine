import {
  HeadContent,
  Scripts,
  createRootRoute,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import * as React from 'react'
import { MessageSquare, Eye, BarChart3 } from 'lucide-react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import { SessionProvider } from '~/context/SessionContext'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'
import { scan } from 'react-scan'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'LLM Council - Distributed AI Consensus',
        description: `LLM Council - A distributed multi-LLM consensus engine running locally`,
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootLayout,
})

function RootLayout() {
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      scan()
    }
  }, [])

  return (
    <html className="h-full">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <SessionProvider>
          <header className="border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="px-6 py-4 max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    LC
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">LLM Council</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Distributed AI Consensus Engine</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex gap-2">
                <Link
                  to="/"
                  activeProps={{
                    className: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
                  }}
                  inactiveProps={{
                    className: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </Link>
                <Link
                  to="/responses"
                  activeProps={{
                    className: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
                  }}
                  inactiveProps={{
                    className: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Responses
                </Link>
                <Link
                  to="/kpis"
                  activeProps={{
                    className: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
                  }}
                  inactiveProps={{
                    className: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm"
                >
                  <BarChart3 className="w-4 h-4" />
                  KPIs
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <TanStackRouterDevtools position="bottom-right" />
        </SessionProvider>
        <Scripts />
      </body>
    </html>
  )
}
