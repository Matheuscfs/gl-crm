/* Google Identity Services (GIS) — OAuth no navegador para Calendar + Drive. */

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const googleConfigured = Boolean(CLIENT_ID)

let accessToken: string | null = null
let tokenExpiry = 0
let gisPromise: Promise<void> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGoogle = any

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if ((window as unknown as { google?: AnyGoogle }).google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'))
    document.head.appendChild(s)
  })
  return gisPromise
}

/** Abre o consentimento do Google e guarda o token de acesso. */
export async function connectGoogle(): Promise<boolean> {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID ausente — configure no .env')
  await loadGis()
  const google = (window as unknown as { google: AnyGoogle }).google
  return new Promise((resolve) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) return resolve(false)
        accessToken = resp.access_token
        tokenExpiry = Date.now() + (resp.expires_in ?? 3600) * 1000
        resolve(true)
      },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export function isGoogleConnected(): boolean {
  return !!accessToken && Date.now() < tokenExpiry - 30_000
}

export function disconnectGoogle() {
  accessToken = null
  tokenExpiry = 0
}

export function googleToken(): string | null {
  return isGoogleConnected() ? accessToken : null
}
