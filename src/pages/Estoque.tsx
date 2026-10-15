import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, FieldRow } from '../components/Field'
import { Menu } from '../components/Menu'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, SkeletonRows } from '../components/States'
import { useToast } from '../components/Toast'
import { SuggestInput } from '../components/SuggestInput'
import { CountUp } from '../components/ui'
import { useStore, precisaComprar, faltando, type EstoqueItem } from '../store'
import { ESTOQUE_STATUS } from '../data'
import { stockCatalog, type CatalogItem } from '../catalog'
import { AREAS, AREA_PADRAO, areaInfo, INVENTARIO_DATA } from '../inventario'
import { supabase } from '../lib/supabase'
import { parseISO, brDate } from '../lib/dates'
import { exportCsv } from '../lib/exportCsv'
import { useTablet } from '../lib/useTablet'
import { DateField } from '../components/DateField'
import EstoqueTablet from './estoque/EstoqueTablet'

const GRID = '1.7fr 0.9fr 0.5fr 0.6fr 0.85fr 0.8fr 0.95fr 34px'
const EMPTY = { item: '', cat: '', qtd: '', min: '', un: '', valor: '', marca: '', validade: '', lote: '', fornecedor: '', ent: INVENTARIO_DATA }

/** Dias até a validade (negativo = vencido). */
const diasValidade = (iso: string) => Math.floor((parseISO(iso).getTime() - Date.now()) / 86400000)

export default function Estoque() {
  const { estoque, addEstoque, updateEstoque, registrarSaida, deleteEstoque, confirmarMinimos, movimentos } = useStore()
  const { toast } = useToast()
  const tablet = useTablet()
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState<EstoqueItem | null>(null)
  const [saida, setSaida] = useState<{ item: EstoqueItem; qtd: string } | null>(null)
  const [confirmDel, setConfirmDel] = useState<EstoqueItem | null>(null)
  const [compras, setCompras] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>(stockCatalog)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('stock_catalog').select('item,cat,un,min').order('item').then(({ data, error }) => {
      if (cancelled || error || !data || data.length === 0) return
      setCatalog(data.map((r) => ({ item: r.item as string, cat: (r.cat as string) ?? '', un: (r.un as string) ?? '', min: (r.min as number) ?? 0 })))
    })
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return estoque.filter((e) => {
      if (area && e.cat !== area) return false
      if (!q) return true
      return e.item.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q)
    })
  }, [query, area, estoque])

  /** Áreas presentes no estoque, na ordem canônica, com contagem e pendências. */
  const areas = useMemo(() => {
    const usadas = new Set(estoque.map((e) => e.cat).filter(Boolean))
    const ordenadas = [...AREAS.filter((a) => usadas.has(a.key)).map((a) => a.key), ...[...usadas].filter((c) => !AREAS.some((a) => a.key === c))]
    return ordenadas.map((key) => {
      const itens = estoque.filter((e) => e.cat === key)
      return { key, info: areaInfo(key) ?? { key, label: key, ...AREA_PADRAO }, total: itens.length, comprar: itens.filter(precisaComprar).length }
    })
  }, [estoque])

  const listaCompras = useMemo(() => estoque.filter(precisaComprar), [estoque])
  const minsSugeridos = useMemo(() => estoque.filter((e) => e.minAuto).length, [estoque])

  const cards = useMemo(() => {
    const cats = new Set(estoque.map((e) => e.cat).filter(Boolean))
    const criticos = estoque.filter((e) => e.status === 'critico')
    const valorTotal = estoque.reduce((s, e) => {
      const v = Number(String(e.valor || '').replace(/\./g, '').replace(',', '.')) || 0
      return s + v * (Number(e.qtd) || 0)
    }, 0)
    return [
      { label: 'Itens cadastrados', value: String(estoque.length), tone: 'var(--primary)', sub: `${cats.size} área${cats.size === 1 ? '' : 's'}` },
      { label: 'Precisa comprar', value: String(listaCompras.length).padStart(2, '0'), tone: '#d97706', sub: listaCompras.length ? 'abaixo do mínimo' : 'tudo em dia' },
      { label: 'Em falta / crítico', value: String(criticos.length).padStart(2, '0'), tone: '#dc2626', sub: criticos[0]?.item ?? 'nenhum item crítico' },
      { label: 'Valor em estoque', value: valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), tone: 'var(--primary)', sub: valorTotal ? 'valor unitário × quantidade' : 'informe os valores unitários' },
    ]
  }, [estoque, listaCompras])

  const submit = () => {
    if (!form.item.trim() || !form.qtd.trim()) {
      toast('Informe o material e a quantidade.', 'error')
      return
    }
    setSaving(true)
    setTimeout(() => {
      addEstoque({
        item: form.item.trim(),
        cat: form.cat.trim() || 'Geral',
        qtd: form.qtd.trim(),
        min: form.min.trim() || '0',
        un: form.un.trim() || 'un',
        valor: form.valor.trim(),
        marca: form.marca.trim(),
        validade: form.validade,
        lote: form.lote.trim(),
        fornecedor: form.fornecedor.trim(),
        ent: form.ent,
      })
      setSaving(false)
      setOpen(false)
      setForm(EMPTY)
      toast('Entrada registrada no estoque.')
    }, 500)
  }

  const textoCompras = () =>
    ['*Lista de compras — GL*', ...listaCompras.map((e) => `• ${e.item} — comprar ${faltando(e)} ${e.un} (tem ${e.qtd}, mínimo ${e.min})`)].join('\n')

  const copiarCompras = async () => {
    try {
      await navigator.clipboard.writeText(textoCompras())
      toast('Lista copiada — é só colar no WhatsApp.')
    } catch {
      toast('Não foi possível copiar a lista.', 'error')
    }
  }

  const baixarCompras = () => {
    exportCsv(
      'lista-de-compras',
      ['Área', 'Item', 'Em estoque', 'Unidade', 'Mínimo', 'Comprar'],
      listaCompras.map((e) => [e.cat, e.item, e.qtd, e.un, e.min, faltando(e)]),
    )
    toast('CSV da lista de compras gerado.')
  }

  const acoesItem = (e: EstoqueItem) => [
    { label: 'Editar item', onClick: () => setEditing(e) },
    { label: 'Registrar saída', onClick: () => setSaida({ item: e, qtd: '1' }) },
    ...(e.minAuto ? [{ label: 'Confirmar mínimo sugerido', onClick: () => { confirmarMinimos([e.item]); toast(`Mínimo de ${e.item} confirmado.`) } }] : []),
    { label: 'Excluir', danger: true, onClick: () => setConfirmDel(e) },
  ]

  const filtros = (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      <button className="chip area-chip" data-on={area === '' || undefined} onClick={() => setArea('')}>
        Todas <span className="tnum">{estoque.length}</span>
      </button>
      {areas.map((a) => (
        <button
          key={a.key}
          className="chip area-chip"
          data-on={area === a.key || undefined}
          onClick={() => setArea(area === a.key ? '' : a.key)}
          style={area === a.key ? { background: a.info.bg, color: a.info.color } : undefined}
        >
          <span aria-hidden>{a.info.emoji}</span> {a.key} <span className="tnum">{a.total}</span>
          {a.comprar > 0 && <span className="area-chip-dot" style={{ background: '#d97706' }} />}
        </button>
      ))}
    </div>
  )

  const modais = (
    <>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova entrada de estoque"
        subtitle="Se o material já existir, a quantidade é somada"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={submit}>Registrar entrada</Button>
          </>
        }
      >
        <Field label="Material">
          <SuggestInput
            autoFocus
            value={form.item}
            options={catalog.map((c) => ({ value: c.item, sub: `${c.cat} · ${c.un}` }))}
            placeholder="Ex.: Resina"
            emptyText="Fora do catálogo — será um material novo."
            onChange={(v) => {
              const hit = catalog.find((c) => c.item.toLowerCase() === v.toLowerCase())
              setForm(hit ? { ...form, item: v, cat: hit.cat, un: hit.un, min: String(hit.min) } : { ...form, item: v })
            }}
          />
        </Field>
        <div style={{ font: "600 11px var(--font)", color: 'var(--muted)', marginTop: -6 }}>
          Comece a digitar — o catálogo preenche área, unidade e mínimo automaticamente.
        </div>
        <FieldRow>
          <Field label="Área">
            <TextInput value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="Ex.: Dentística" />
          </Field>
          <Field label="Unidade">
            <TextInput value={form.un} onChange={(e) => setForm({ ...form, un: e.target.value })} placeholder="Ex.: caixa" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Quantidade">
            <TextInput type="number" value={form.qtd} onChange={(e) => setForm({ ...form, qtd: e.target.value })} placeholder="Ex.: 10" />
          </Field>
          <Field label="Estoque mínimo">
            <TextInput type="number" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} placeholder="Ex.: 8" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Valor unitário (R$)">
            <TextInput inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Ex.: 89,90" />
          </Field>
          <Field label="Marca (opcional)">
            <TextInput value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Ex.: 3M" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Validade (opcional)">
            <DateField value={form.validade} onChange={(iso) => setForm({ ...form, validade: iso })} />
          </Field>
          <Field label="Lote (opcional)">
            <TextInput value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} placeholder="Ex.: L2301" />
          </Field>
        </FieldRow>
        <Field label="Fornecedor (opcional)">
          <TextInput value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} placeholder="Ex.: Dental Cremer" />
        </Field>
      </Modal>

      {/* Editar item */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar item" subtitle={editing?.item}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={() => { if (editing) { updateEstoque(editing.item, editing); setEditing(null); toast('Item atualizado.') } }}>Salvar</Button></>}>
        {editing && (
          <>
            <Field label="Material"><TextInput value={editing.item} onChange={(e) => setEditing({ ...editing, item: e.target.value })} /></Field>
            <FieldRow>
              <Field label="Área"><TextInput value={editing.cat} onChange={(e) => setEditing({ ...editing, cat: e.target.value })} /></Field>
              <Field label="Unidade"><TextInput value={editing.un} onChange={(e) => setEditing({ ...editing, un: e.target.value })} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Quantidade"><TextInput type="number" value={editing.qtd} onChange={(e) => setEditing({ ...editing, qtd: e.target.value })} /></Field>
              <Field label="Estoque mínimo"><TextInput type="number" value={editing.min} onChange={(e) => setEditing({ ...editing, min: e.target.value })} /></Field>
            </FieldRow>
            {editing.minAuto && (
              <div style={{ font: "600 11.5px var(--font)", color: 'var(--amber-dark)', background: 'var(--amber-bg)', padding: '8px 10px', borderRadius: 10, marginTop: -4 }}>
                Mínimo sugerido pelo sistema. Salvar com outro valor confirma o seu.
              </div>
            )}
            <FieldRow>
              <Field label="Valor unitário (R$)"><TextInput inputMode="decimal" value={editing.valor ?? ''} onChange={(e) => setEditing({ ...editing, valor: e.target.value })} placeholder="Ex.: 89,90" /></Field>
              <Field label="Marca (opcional)"><TextInput value={editing.marca ?? ''} onChange={(e) => setEditing({ ...editing, marca: e.target.value })} placeholder="Ex.: 3M" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Validade (opcional)"><DateField value={editing.validade ?? ''} onChange={(iso) => setEditing({ ...editing, validade: iso })} /></Field>
              <Field label="Lote (opcional)"><TextInput value={editing.lote ?? ''} onChange={(e) => setEditing({ ...editing, lote: e.target.value })} placeholder="Ex.: L2301" /></Field>
            </FieldRow>
            <Field label="Fornecedor (opcional)"><TextInput value={editing.fornecedor ?? ''} onChange={(e) => setEditing({ ...editing, fornecedor: e.target.value })} placeholder="Ex.: Dental Cremer" /></Field>
          </>
        )}
      </Modal>

      {/* Registrar saída */}
      <Modal open={!!saida} onClose={() => setSaida(null)} title="Registrar saída" subtitle={saida?.item.item} width={380}
        footer={<><Button variant="outline" onClick={() => setSaida(null)}>Cancelar</Button><Button onClick={() => { if (saida) { registrarSaida(saida.item.item, Number(saida.qtd) || 0); setSaida(null); toast('Saída registrada.') } }}>Dar baixa</Button></>}>
        {saida && (
          <>
            <div style={{ font: "600 12.5px var(--font)", color: 'var(--slate)' }}>Em estoque: <b style={{ color: 'var(--ink)' }}>{saida.item.qtd} {saida.item.un}</b></div>
            <Field label="Quantidade a retirar"><TextInput type="number" autoFocus value={saida.qtd} onChange={(e) => setSaida({ ...saida, qtd: e.target.value })} /></Field>
          </>
        )}
      </Modal>

      {/* Lista de compras */}
      <Modal open={compras} onClose={() => setCompras(false)} title="Lista de compras" width={560}
        subtitle={listaCompras.length ? `${listaCompras.length} ${listaCompras.length === 1 ? 'item abaixo do mínimo' : 'itens abaixo do mínimo'}` : 'Nenhum item abaixo do mínimo'}
        footer={
          <>
            <Button variant="outline" onClick={() => setCompras(false)}>Fechar</Button>
            <Button variant="outline" onClick={baixarCompras} disabled={!listaCompras.length}>Exportar CSV</Button>
            <Button onClick={copiarCompras} disabled={!listaCompras.length}>Copiar lista</Button>
          </>
        }>
        {listaCompras.length === 0 && (
          <div style={{ font: "600 12.5px var(--font)", color: 'var(--slate)' }}>Todo o estoque está acima do mínimo. 🎉</div>
        )}
        {listaCompras.map((e) => {
          const info = areaInfo(e.cat) ?? { ...AREA_PADRAO, key: e.cat, label: e.cat }
          return (
            <div key={e.item} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: info.bg, fontSize: 15 }} aria-hidden>{info.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 13px var(--font)", color: 'var(--ink)' }}>{e.item}</div>
                <div style={{ font: "600 11.5px var(--font)", color: 'var(--muted)' }}>tem {e.qtd} · mínimo {e.min} {e.un}</div>
              </div>
              <span className="tnum" style={{ font: "800 13px var(--font)", color: 'var(--amber-dark)' }}>+{faltando(e)} {e.un}</span>
            </div>
          )
        })}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => { if (confirmDel) { deleteEstoque(confirmDel.item); toast('Item excluído.') } }}
        title="Excluir item" message={`Remover ${confirmDel?.item ?? ''} do estoque?`} />
    </>
  )

  const avisoMinimos = minsSugeridos > 0 && (
    <div className="minimo-aviso">
      <span aria-hidden style={{ fontSize: 15 }}>💡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{minsSugeridos} {minsSugeridos === 1 ? 'item está' : 'itens estão'} com estoque mínimo sugerido.</b>{' '}
        Confira e confirme — é o mínimo que define o “precisa comprar”.
      </div>
      <Button size="sm" variant="outline" onClick={() => { confirmarMinimos(); toast('Mínimos sugeridos confirmados.') }}>Confirmar todos</Button>
    </div>
  )

  if (tablet) {
    return (
      <EstoqueTablet
        rows={rows}
        areas={areas}
        area={area}
        onArea={setArea}
        query={query}
        onQuery={setQuery}
        listaCompras={listaCompras}
        aviso={avisoMinimos}
        loading={loading}
        onNova={() => setOpen(true)}
        onCompras={() => setCompras(true)}
        onEditar={setEditing}
        onMais={(e) => addEstoque({ ...e, qtd: '1', minAuto: e.minAuto })}
        onMenos={(e) => registrarSaida(e.item, 1)}
        modais={modais}
      />
    )
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Estoque</div>
        <div className="topbar-actions">
          <label className="searchbox" style={{ width: 260 }}>
            <Icon name="search" size={18} />
            <input placeholder="Buscar material…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <Button variant="outline" onClick={() => setCompras(true)}>
            Lista de compras{listaCompras.length ? ` (${listaCompras.length})` : ''}
          </Button>
          <Button icon={<Icon name="plus" size={17} />} onClick={() => setOpen(true)}>
            Nova entrada
          </Button>
        </div>
      </header>

      <div className="page-body">
        <div className="stagger grid-kpi">
          {cards.map((c) => (
            <div key={c.label} className="card card-hover kpi-card">
              <div className="kpi-label">{c.label}</div>
              <div className="kpi-value tnum"><CountUp value={c.value} /></div>
              <div className="kpi-sub">
                <span className="kpi-dot" style={{ background: c.tone }} />
                <span>{c.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {avisoMinimos}
        {filtros}

        <div className="split" style={{ flex: 1, minHeight: 340, '--main': '1.55fr' } as React.CSSProperties}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', font: "800 15px var(--font)", color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>
              Itens em estoque <span style={{ font: "600 12px var(--font)", color: 'var(--muted)' }}>{rows.length} de {estoque.length}</span>
            </div>
            <div className="table-x" style={{ '--table-min': '760px' } as React.CSSProperties}>
            <div className="table-head" style={{ gridTemplateColumns: GRID, gap: 14, padding: '10px 20px' }}>
              <span>MATERIAL</span>
              <span>ÁREA</span>
              <span style={{ textAlign: 'right' }}>QTD.</span>
              <span style={{ textAlign: 'right' }}>MÍN.</span>
              <span style={{ textAlign: 'center' }}>COMPRAR</span>
              <span>VALIDADE</span>
              <span style={{ textAlign: 'right' }}>STATUS</span>
              <span />
            </div>
            <div className="table-body">
              {loading && <SkeletonRows rows={6} />}
              {!loading && rows.length === 0 && <EmptyState icon="box" title="Nenhum material" desc="Nada encontrado na busca ou estoque vazio." action={<Button icon={<Icon name="plus" size={17} />} onClick={() => setOpen(true)}>Nova entrada</Button>} />}
              {!loading && rows.map((e) => {
                const st = ESTOQUE_STATUS[e.status]
                const comprar = precisaComprar(e)
                const info = areaInfo(e.cat)
                return (
                  <div key={e.item} className="table-row" style={{ gridTemplateColumns: GRID, gap: 14, padding: '12px 20px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: "700 12.5px var(--font)", color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.item}</div>
                      <div style={{ font: "600 11px var(--font)", color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[e.un, e.marca, e.valor && `R$ ${e.valor}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span style={{ font: "600 12px var(--font)", color: info?.color ?? 'var(--slate)', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      {info && <span aria-hidden>{info.emoji}</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.cat}</span>
                    </span>
                    <span className="tnum" style={{ font: "800 13px var(--font)", color: st.qty, textAlign: 'right' }}>{e.qtd}</span>
                    <span className="tnum" style={{ font: "600 12px var(--font)", color: e.minAuto ? '#b0791f' : 'var(--muted)', textAlign: 'right' }} title={e.minAuto ? 'Mínimo sugerido — confirme na edição do item' : undefined}>
                      {e.min}{e.minAuto ? '*' : ''}
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      {comprar
                        ? <span className="pill" style={{ background: 'var(--amber-bg)', color: 'var(--amber-dark)' }}>Sim · +{faltando(e)}</span>
                        : <span style={{ font: "700 11px var(--font)", color: 'var(--border-strong)' }}>Não</span>}
                    </span>
                    {(() => {
                      if (!e.validade) return <span className="tnum" style={{ font: "600 12px var(--font)", color: 'var(--border-strong)' }}>—</span>
                      const dias = diasValidade(e.validade)
                      const color = dias < 0 ? 'var(--danger-text)' : dias <= 60 ? 'var(--amber-dark)' : 'var(--slate)'
                      return (
                        <span title={e.lote ? `Lote ${e.lote}` : undefined}>
                          <span className="tnum" style={{ display: 'block', font: "600 12px var(--font)", color }}>{brDate(e.validade)}</span>
                          {dias < 0 && <span style={{ font: "700 10px var(--font)", color: 'var(--danger-text)' }}>vencido</span>}
                          {dias >= 0 && dias <= 60 && <span style={{ font: "700 10px var(--font)", color: 'var(--amber-dark)' }}>vence em {dias}d</span>}
                        </span>
                      )
                    })()}
                    <span style={{ textAlign: 'right' }}>
                      <span className="pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Menu width={230} items={acoesItem(e)} />
                    </span>
                  </div>
                )
              })}
            </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
            <div className="card" style={{ padding: '16px 18px', flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ font: "800 14px var(--font)", color: 'var(--ink)', marginBottom: 8 }}>Movimentações recentes</div>
              {movimentos.length === 0 && <div style={{ font: "600 12px var(--font)", color: 'var(--muted)', padding: '10px 0' }}>Nenhuma movimentação ainda.</div>}
              {movimentos.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: m.kind === 'entrada' ? '#16a34a' : '#d97706' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 12.5px var(--font)", color: 'var(--ink)' }}>{m.tipo} · {m.desc}</div>
                    <div style={{ font: "600 11px var(--font)", color: 'var(--muted)' }}>{m.when}</div>
                  </div>
                  <span className="tnum" style={{ font: "800 12px var(--font)", color: m.kind === 'entrada' ? 'var(--green-dark)' : 'var(--amber-dark)' }}>{m.delta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modais}
    </>
  )
}
