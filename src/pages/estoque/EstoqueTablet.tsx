import type { ReactNode } from 'react'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { SkeletonRows } from '../../components/States'
import { ESTOQUE_STATUS } from '../../data'
import { precisaComprar, faltando, type EstoqueItem } from '../../store'
import { AREA_PADRAO, areaInfo, type AreaInfo } from '../../inventario'

export interface AreaResumo {
  key: string
  info: AreaInfo
  total: number
  comprar: number
}

/**
 * Estoque no modo tablet — leitura estilo Apple Health: cartões grandes por área,
 * lista com passo rápido (− / +) e a lista de compras em destaque.
 */
export default function EstoqueTablet({
  rows, areas, area, onArea, query, onQuery, listaCompras, aviso, loading,
  onNova, onCompras, onEditar, onMais, onMenos, modais,
}: {
  rows: EstoqueItem[]
  areas: AreaResumo[]
  area: string
  onArea: (a: string) => void
  query: string
  onQuery: (q: string) => void
  listaCompras: EstoqueItem[]
  aviso: ReactNode
  loading: boolean
  onNova: () => void
  onCompras: () => void
  onEditar: (e: EstoqueItem) => void
  onMais: (e: EstoqueItem) => void
  onMenos: (e: EstoqueItem) => void
  modais: ReactNode
}) {
  const total = areas.reduce((s, a) => s + a.total, 0)
  const areaAtual = areas.find((a) => a.key === area)

  return (
    <>
      <header className="hl-topbar">
        <div style={{ minWidth: 0 }}>
          <div className="hl-title">Estoque</div>
          <div className="hl-sub">
            {total} {total === 1 ? 'item' : 'itens'}
            {listaCompras.length > 0 && <> · <span style={{ color: 'var(--amber-dark)' }}>{listaCompras.length} a repor</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          <Button variant="outline" onClick={onCompras}>Compras{listaCompras.length ? ` (${listaCompras.length})` : ''}</Button>
          <Button icon={<Icon name="plus" size={17} />} onClick={onNova}>Entrada</Button>
        </div>
      </header>

      <div className="hl-scroll">
        <label className="searchbox">
          <Icon name="search" size={18} />
          <input placeholder="Buscar material…" value={query} onChange={(e) => onQuery(e.target.value)} />
        </label>

        {aviso}

        <button className="hl-card hl-buy" onClick={onCompras}>
          <span className="hl-buy-emoji" aria-hidden>🛒</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span className="hl-buy-label">Lista de compras</span>
            <span className="hl-buy-sub">
              {listaCompras.length
                ? listaCompras.slice(0, 3).map((e) => e.item).join(', ') + (listaCompras.length > 3 ? ` +${listaCompras.length - 3}` : '')
                : 'Todo o estoque acima do mínimo'}
            </span>
          </span>
          <span className="hl-buy-num tnum">{listaCompras.length}</span>
          <span className="chev-right"><Icon name="chevron" size={20} /></span>
        </button>

        <div className="hl-section">Áreas</div>
        <div className="hl-grid">
          {areas.map((a) => (
            <button
              key={a.key}
              className={`hl-card hl-area${area === a.key ? ' on' : ''}`}
              style={{ '--area': a.info.color, '--area-bg': a.info.bg } as React.CSSProperties}
              onClick={() => onArea(area === a.key ? '' : a.key)}
            >
              <span className="hl-area-emoji" aria-hidden>{a.info.emoji}</span>
              <span className="hl-area-name">{a.key}</span>
              <span className="hl-area-num tnum">{a.total}</span>
              <span className="hl-area-sub">{a.comprar ? `${a.comprar} a repor` : 'em dia'}</span>
            </button>
          ))}
        </div>

        <div className="hl-section">
          {areaAtual ? areaAtual.info.label : 'Todos os itens'}
          {areaAtual && <button className="hl-section-link" onClick={() => onArea('')}>ver tudo</button>}
        </div>

        <div className="hl-list">
          {loading && <SkeletonRows rows={6} />}
          {!loading && rows.length === 0 && (
            <div className="hl-empty">Nenhum material encontrado.</div>
          )}
          {!loading && rows.map((e) => {
            const info = areaInfo(e.cat) ?? { ...AREA_PADRAO, key: e.cat, label: e.cat }
            const st = ESTOQUE_STATUS[e.status]
            const comprar = precisaComprar(e)
            return (
              <div key={e.item} className="hl-row">
                <span className="hl-row-emoji" style={{ background: info.bg }} aria-hidden>{info.emoji}</span>
                <button className="hl-row-main" onClick={() => onEditar(e)}>
                  <span className="hl-row-name">{e.item}</span>
                  <span className="hl-row-sub">
                    mínimo {e.min}{e.minAuto ? ' (sugerido)' : ''} {e.un}
                    {comprar && <span className="hl-row-buy">comprar +{faltando(e)}</span>}
                  </span>
                </button>
                <span className="hl-step">
                  <button aria-label={`Retirar 1 ${e.item}`} onClick={() => onMenos(e)} disabled={Number(e.qtd) <= 0}>−</button>
                  <b className="tnum" style={{ color: st.qty }}>{e.qtd}</b>
                  <button aria-label={`Adicionar 1 ${e.item}`} onClick={() => onMais(e)}>+</button>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {modais}
    </>
  )
}
