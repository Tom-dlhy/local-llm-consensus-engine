import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'

export const Route = createFileRoute('/kpis')({
  component: KPIsPage,
})

function KPIsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          Key Performance Indicators
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Monitor council performance and system metrics
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Placeholder KPI Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Total Sessions
              </h3>
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">0</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">No active sessions</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Avg. Response Time
              </h3>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">-</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Collecting data</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Total Tokens Used
              </h3>
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">0</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Across all sessions</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Avg. Consensus Score
              </h3>
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">-</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Not available</p>
          </div>
        </div>

        {/* Detailed Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4">
              Stage Duration Metrics
            </h3>
            <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <p>Chart data will appear here</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4">
              Token Usage Distribution
            </h3>
            <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <p>Chart data will appear here</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700 lg:col-span-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4">
              Session History
            </h3>
            <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <p>Session history will appear here</p>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-200">
            💡 <strong>Tip:</strong> Run council sessions from the Chat page to populate these metrics.
          </p>
        </div>
      </div>
    </div>
  )
}
