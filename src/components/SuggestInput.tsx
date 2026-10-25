import { useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../icons'
import { useOutsideClick } from './useOutsideClick'
import { Popover } from './Popover'

export interface SuggestOption<T = unknown> {
  /** Texto que vai para o campo ao escolher. */
  value: string
  sub?: string
  /** Chave da linha quando `value` pode repetir (ex.: dois pacientes homônimos). */
  key?: string
  /** À esquerda (avatar) e à direita (preço) da linha. */
  lead?: ReactNode
  trail?: ReactNode
  /** O registro por trás da opção, devolvido no `onPick`. */
  item?: T
}

/** Minúsculas e sem acento: "jose" acha "José". */
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Campo com sugestões estilizadas — substitui o <datalist> nativo, que não aceita CSS e
 * abre o popup do navegador fora de posição. Único componente de busca-com-lista do app
 * (procedimento, material, paciente da Agenda…). Digitar filtra (sem acento); setas e Enter
 * escolhem pelo teclado; a lista vai por portal e não é cortada dentro de modal.
 */
export function SuggestInput<T = unknown>({ value, options, placeholder, autoFocus, emptyText, onChange, onPick, limit, chevron = true }: {
  value: string
  options: SuggestOption<T>[]
  placeholder?: string
  autoFocus?: boolean
  emptyText?: string
  onChange: (v: string) => void
  /** Escolheu da lista (sem ele, a escolha vai para o `onChange`). */
  onPick?: (v: string, option: SuggestOption<T>) => void
  /** Quantas linhas mostrar no máximo. */
  limit?: number
  chevron?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [ativo, setAtivo] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listaId = useId()
  const fechar = () => { setOpen(false); setAtivo(-1) }
  useOutsideClick([ref, popRef], fechar, open)

  const termo = semAcento(value.trim())
  const filtradas = termo ? options.filter((o) => semAcento(o.value).includes(termo)) : options
  const results = limit ? filtradas.slice(0, limit) : filtradas

  const escolher = (o: SuggestOption<T>) => {
    if (onPick) onPick(o.value, o)
    else onChange(o.value)
    fechar()
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (!results.length) return
      const passo = e.key === 'ArrowDown' ? 1 : -1
      setAtivo((i) => (i < 0 ? (passo > 0 ? 0 : results.length - 1) : (i + passo + results.length) % results.length))
    } else if (e.key === 'Enter' && open && ativo >= 0 && results[ativo]) {
      e.preventDefault()
      escolher(results[ativo])
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="field-input"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={open && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
        onClick={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setAtivo(-1) }}
        onKeyDown={onKeyDown}
        style={chevron ? { paddingRight: 34 } : undefined}
      />
      {chevron && (
        <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', display: 'flex' }}>
          <Icon name="chevDown" size={16} />
        </span>
      )}
      <Popover anchor={ref} popRef={popRef} open={open} matchWidth style={{ maxHeight: 240 }}>
        <div id={listaId} role="listbox" style={{ display: 'contents' }}>
          {results.length === 0 ? (
            <div style={{ padding: '9px 11px', font: '400 12px var(--font)', color: 'var(--muted)' }}>{emptyText ?? 'Sem correspondência.'}</div>
          ) : results.map((o, i) => (
            <button
              key={o.key ?? o.value}
              id={`${listaId}-${i}`}
              type="button"
              role="option"
              aria-selected={i === ativo}
              className={`menu-item${i === ativo ? ' selected' : ''}`}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => escolher(o)}
            >
              {o.lead}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ font: '500 12.5px var(--font)', color: 'var(--ink)' }}>{o.value}</span>
                {o.sub && <span style={{ font: '400 11px var(--font)', color: 'var(--muted)' }}>{o.sub}</span>}
              </span>
              {o.trail}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}
