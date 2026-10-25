import { useTema, type TemaPref } from '../lib/theme'

const OPCOES: { key: TemaPref; label: string }[] = [
  { key: 'claro', label: 'Claro' },
  { key: 'escuro', label: 'Escuro' },
  { key: 'auto', label: 'Automático' },
]

/** Seletor de aparência (Claro / Escuro / Automático), como em Ajustes › Tela e Brilho. */
export function TemaSeletor({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const [pref, trocar] = useTema()
  return (
    <div className={`seg-sm tema-seg${size === 'md' ? ' md' : ''}`} role="group" aria-label="Aparência">
      {OPCOES.map((o) => (
        <button key={o.key} aria-pressed={pref === o.key} onClick={() => trocar(o.key)}>{o.label}</button>
      ))}
    </div>
  )
}
