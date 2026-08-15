import { createContext, useContext, useState, type ReactNode } from 'react'
import { connectGoogle, disconnectGoogle, isGoogleConnected, googleConfigured } from './google'

interface GoogleApi {
  connected: boolean
  configured: boolean
  connecting: boolean
  connect: () => Promise<boolean>
  disconnect: () => void
}

const Ctx = createContext<GoogleApi>({
  connected: false,
  configured: googleConfigured,
  connecting: false,
  connect: async () => false,
  disconnect: () => {},
})

export function useGoogle() {
  return useContext(Ctx)
}

export function GoogleProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(isGoogleConnected())
  const [connecting, setConnecting] = useState(false)

  const connect = async () => {
    setConnecting(true)
    try {
      const ok = await connectGoogle()
      setConnected(ok)
      return ok
    } catch (e) {
      console.error('[google]', e)
      return false
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = () => {
    disconnectGoogle()
    setConnected(false)
  }

  return <Ctx.Provider value={{ connected, configured: googleConfigured, connecting, connect, disconnect }}>{children}</Ctx.Provider>
}
