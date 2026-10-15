/*
 * Desenhos dos ícones: Lucide (https://lucide.dev, licença ISC — © Lucide Contributors,
 * partes © Cole Bemis/Feather, MIT), grade 24×24 com traço arredondado, no espírito dos
 * SF Symbols. Convertidos para caminhos `d` para o ícone poder ser "desenhado" por CSS.
 */
const PATHS = {
  home: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  cal: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z', 'M3 10h18'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  funnel: ['M22 3L2 3L10 12.46L10 19L14 21L14 12.46L22 3z'],
  dollar: ['M12 2L12 22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  gear: ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
  search: ['M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0', 'm21 21-4.3-4.3'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  plus: ['M5 12h14', 'M12 5v14'],
  print: ['M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6', 'M7 14h10a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1z'],
  share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6L12 2L8 6', 'M12 2L12 15'],
  dots: ['M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  box: ['M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z', 'M12 22V12', 'm3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7', 'm7.5 4.27 9 5.15'],
  back: ['m15 18-6-6 6-6'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  chat: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  menu: ['M4 12L20 12', 'M4 6L20 6', 'M4 18L20 18'],
  chevron: ['m15 18-6-6 6-6'],
  pie: ['M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z', 'M21.21 15.89A10 10 0 1 1 8 2.83'],
  help: ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  clipboard: ['M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M12 11h4', 'M12 16h4', 'M8 11h.01', 'M8 16h.01'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2', 'M10 11L10 17', 'M14 11L14 17'],
  chart: ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  check: ['M20 6 9 17l-5-5'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  more: ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'M17 12h.01', 'M12 12h.01', 'M7 12h.01'],
  clock: ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'M12 6L12 12L16 14'],
  chevDown: ['m6 9 6 6 6-6'],
  chevUpDown: ['m7 15 5 5 5-5', 'm7 9 5-5 5 5'],
  list: ['M3 12h.01', 'M3 18h.01', 'M3 6h.01', 'M8 12h13', 'M8 18h13', 'M8 6h13'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17L21 12L16 7', 'M21 12L9 12'],
  wallet: ['M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1', 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'],
  stethoscope: ['M11 2v2', 'M5 2v2', 'M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1', 'M8 15a6 6 0 0 0 12 0v-3', 'M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'],
  wa: [
    'M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.3A9 9 0 1 0 12 3z',
    'M8.5 8.5c0 4 3 7 7 7 1 0 1.4-1 1.4-1.6 0-.3-.2-.5-.4-.6l-1.7-.8c-.3-.1-.5 0-.7.2l-.4.5c-1.2-.5-2.2-1.5-2.7-2.7l.5-.4c.2-.2.3-.4.2-.7l-.8-1.7c-.1-.2-.3-.4-.6-.4-.6 0-1.5.4-1.5 1.5z',
  ],
} as const

export type IconName = keyof typeof PATHS

/**
 * Versões preenchidas (como os SF Symbols ".fill" do iOS): a aba ativa troca o
 * contorno pelo desenho cheio. `fill` pinta com a cor do texto; `knock` risca
 * por cima com a cor do fundo para recortar linhas; `stroke` é contorno normal.
 */
type Part = { d: string; kind: 'fill' | 'solid' | 'knock' | 'stroke' }
const B = (d: string): Part => ({ d, kind: 'solid' })
const K = (d: string): Part => ({ d, kind: 'knock' })
const S = (d: string): Part => ({ d, kind: 'stroke' })
const FILLED: Partial<Record<IconName, Part[]>> = {
  home: [B('M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'), K('M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8')],
  cal: [B('M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'), K('M3.5 10h17'), K('M8 14h.01'), K('M12 14h.01'), K('M16 14h.01'), K('M8 18h.01'), K('M12 18h.01'), S('M8 2v4'), S('M16 2v4')],
  users: [B('M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0'), B('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2z'), S('M22 21v-2a4 4 0 0 0-3-3.87'), S('M16 3.13a4 4 0 0 1 0 7.75')],
  box: [B('M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'), K('M12 21.5V12'), K('m3.6 7.2 7.4 4.5a2 2 0 0 0 2 0l7.4-4.5'), K('m7.5 4.27 9 5.15')],
  more: [B('M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0'), K('M17 12h.01'), K('M12 12h.01'), K('M7 12h.01')],
  chat: [B('M7.9 20A9 9 0 1 0 4 16.1L2 22Z')],
  wallet: [B('M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1'), B('M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4h-3a2 2 0 0 1 0-4h3V8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z')],
}

export function Icon({ name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  const parts = filled ? FILLED[name] : undefined
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {parts
        ? parts.map((p, i) => (
            <path key={i} d={p.d}
              fill={p.kind === 'fill' || p.kind === 'solid' ? 'currentColor' : 'none'}
              stroke={p.kind === 'fill' ? 'none' : p.kind === 'knock' ? 'var(--icon-knock, #fff)' : 'currentColor'}
              strokeWidth={p.kind === 'knock' ? 1.9 : undefined} />
          ))
        // pathLength 1: o contorno pode ser "desenhado" por CSS (stroke-dasharray) em qualquer ícone
        : PATHS[name].map((d, i) => <path key={i} d={d} pathLength={1} />)}
    </svg>
  )
}
