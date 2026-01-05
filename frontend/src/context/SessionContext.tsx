/**
 * Session Context for LLM Council
 * Manages the current council session state across pages
 */

import React, { createContext, useContext, useState } from 'react'
import type { CouncilSession } from '~/types/council'

interface SessionContextType {
  session: CouncilSession | null
  setSession: (session: CouncilSession | null) => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CouncilSession | null>(null)

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
