import { googleToken } from './google'

const pad = (n: number) => String(n).padStart(2, '0')
const CALENDAR_ID = (import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined) || 'primary'

/** Cria um evento no Google Calendar a partir de um agendamento (data real, uma via). */
export async function pushAppointment(ev: { date: string; start: number; dur: number; child: string; proc: string; kind?: string }): Promise<string | null> {
  const token = googleToken()
  if (!token) return null

  const sH = Math.floor(ev.start)
  const sM = Math.round((ev.start - sH) * 60)
  const endTotal = ev.start + ev.dur
  const eH = Math.floor(endTotal)
  const eM = Math.round((endTotal - eH) * 60)

  const body = {
    summary: `${ev.child} — ${ev.proc}`,
    description: `Atendimento ${ev.kind === 'est' ? 'estético' : ev.kind === 'adt' ? 'adulto' : 'pediátrico'} · CRM Gabriela Lorenzi`,
    start: { dateTime: `${ev.date}T${pad(sH)}:${pad(sM)}:00`, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: `${ev.date}T${pad(eH)}:${pad(eM)}:00`, timeZone: 'America/Sao_Paulo' },
  }

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('[gcal]', await res.text())
    return null
  }
  return (await res.json()).id as string
}
