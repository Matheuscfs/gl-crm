/* Utilitários de data para a agenda (datas reais). */

const WEEKDAY = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTHS_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** Segunda-feira da semana que contém `d`. */
export function mondayOf(d: Date): string {
  const day = d.getDay() // 0=Dom .. 6=Sáb
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return isoDate(m)
}

export const todayISO = () => isoDate(new Date())

/** Colunas SEG..SÁB (6 dias) a partir de uma segunda-feira. */
export function weekColumns(mondayISO: string): { iso: string; d: string; n: string; today: boolean }[] {
  const today = todayISO()
  return Array.from({ length: 6 }, (_, i) => {
    const iso = addDays(mondayISO, i)
    const dt = parseISO(iso)
    return { iso, d: WEEKDAY[dt.getDay()], n: String(dt.getDate()), today: iso === today }
  })
}

/** "15 – 20 de julho de 2026" (ou com meses/anos distintos). */
export function weekRangeLabel(mondayISO: string): string {
  const a = parseISO(mondayISO)
  const b = parseISO(addDays(mondayISO, 5))
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} de ${MONTHS[a.getMonth()]} de ${a.getFullYear()}`
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${MONTHS_ABBR[a.getMonth()]} – ${b.getDate()} ${MONTHS_ABBR[b.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MONTHS_ABBR[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS_ABBR[b.getMonth()]} ${b.getFullYear()}`
}

/** "qua, 17 de julho" */
export function longDate(iso: string): string {
  const d = parseISO(iso)
  return `${WEEKDAY[d.getDay()].toLowerCase()}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** ISO (aaaa-mm-dd) → "dd/mm/aaaa". Vazio se a data for inválida. */
export function brDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const d = parseISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** "dd/mm/aaaa" → "aaaa-mm-dd", ou '' se inválido. */
export function brToIso(s: string): string {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** Vencimento em "dd/mm/aaaa" já passou? (o status "vencida" é derivado, nunca gravado) */
export function isVencidaBr(vencBr: string): boolean {
  const iso = brToIso(vencBr)
  return !!iso && iso < todayISO()
}

/** "dd/mm/aaaa" → ISO (aaaa-mm-dd), ou null se não for uma data válida. */
export function parseBr(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const day = Number(m[1])
  const mon = Number(m[2])
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null
  const d = new Date(year, mon - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== mon - 1 || d.getDate() !== day) return null
  return isoDate(d)
}

/** Aplica a máscara "dd/mm/aaaa" enquanto o usuário digita. */
export function maskBr(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length > 2) out += '/' + d.slice(2, 4)
  if (d.length > 4) out += '/' + d.slice(4, 8)
  return out
}
