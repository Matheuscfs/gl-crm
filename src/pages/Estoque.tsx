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
import { useStore, type EstoqueItem } from '../store'
import { ESTOQUE_STATUS } from '../data'
import { stockCatalog, type CatalogItem } from '../catalog'
import { supabase } from '../lib/supabase'
import { parseISO, brDate } from '../lib/dates'
import { DateField } from '../components/DateField'

const GRID = '1.7fr 0.85fr 0.5fr 0.5fr 0.7fr 0.8fr 0.7fr 0.9fr 34px'
const EMPTY = { item: '', cat: '', qtd: '', min: '', un: '', valor: '', marca: '', validade: '', lote: '', fornecedor: '', ent: '17/07' }

/** Dias até a validade (negativo = vencido). */
const diasValidade = (iso: string) => Math.floor((parseISO(iso).getTime() - Date.now()) / 86400000)

export default function Estoque() {
  const { estoque, addEstoque, updateEstoque, registrarSaida, deleteEstoque, movimentos } = useStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState<EstoqueItem | null>(null)
  const [saida, setSaida] = useState<{ item: EstoqueItem; qtd: string } | null>(null)
  const [confirmDel, setConfirmDel] = useState<EstoqueItem | null>(null)
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
    if (!q) return estoque
    return estoque.filter((e) => e.item.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q))
  }, [query, estoque])

  // cards de resumo computados do estoque real
  const cards = useMemo(() => {
    const cats = new Set(estoque.map((e) => e.cat).filter(Boolean))
    const baixo = estoque.filter((e) => e.status === 'baixo').length
    const criticos = estoque.filter((e) => e.status === 'critico')
    const valorTotal = estoque.reduce((s, e) => {
      const v = Number(String(e.valor || '').replace(/\./g, '').replace(',', '.')) || 0
      return s + v * (Number(e.qtd) || 0)
    }, 0)
    return [
      { label: 'Itens cadastrados', value: String(estoque.length), tone: '#3f6bf5', sub: `${cats.size} categoria${cats.size === 1 ? '' : 's'}` },
      { label: 'Abaixo do mínimo', value: String(baixo).padStart(2, '0'), tone: '#d97706', sub: baixo ? 'repor esta semana' : 'tudo em dia' },
      { label: 'Em falta / crítico', value: String(criticos.length).padStart(2, '0'), tone: '#dc2626', sub: criticos[0]?.item ?? 'nenhum item crítico' },
      { label: 'Valor em estoque', value: valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), tone: '#3f6bf5', sub: 'valor unitário × quantidade' },
    ]
  }, [estoque])

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
        un: form.un.trim() || 'unid',
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

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Estoque</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="searchbox" style={{ width: 280 }}>
            <Icon name="search" size={18} />
            <input placeholder="Buscar material…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <Button icon={<Icon name="plus" size={17} />} onClick={() => setOpen(true)}>
            Nova entrada
          </Button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {cards.map((c) => (
            <div key={c.label} className="card card-hover" style={{ padding: '17px 18px' }}>
              <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8a9699' }}>{c.label}</div>
              <div className="tnum" style={{ font: "800 26px 'Plus Jakarta Sans'", color: '#1a2426', margin: '7px 0 5px' }}><CountUp value={c.value} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.tone }} />
                <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>{c.sub}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 340, display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', font: "800 15px 'Plus Jakarta Sans'", color: '#1a2426', borderBottom: '1px solid #f0f2f2' }}>
              Itens em estoque
            </div>
            <div className="table-head" style={{ gridTemplateColumns: GRID, gap: 14, padding: '10px 20px' }}>
              <span>MATERIAL</span>
              <span>CATEGORIA</span>
              <span style={{ textAlign: 'right' }}>QTD.</span>
              <span style={{ textAlign: 'right' }}>MÍN.</span>
              <span style={{ textAlign: 'right' }}>VALOR</span>
              <span>VALIDADE</span>
              <span>ÚLT. ENT.</span>
              <span style={{ textAlign: 'right' }}>STATUS</span>
              <span />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading && <SkeletonRows rows={6} />}
              {!loading && rows.length === 0 && <EmptyState icon="box" title="Nenhum material" desc="Nada encontrado na busca ou estoque vazio." action={<Button icon={<Icon name="plus" size={17} />} onClick={() => setOpen(true)}>Nova entrada</Button>} />}
              {!loading && rows.map((e) => {
                const st = ESTOQUE_STATUS[e.status]
                return (
                  <div key={e.item} className="table-row" style={{ gridTemplateColumns: GRID, gap: 14, padding: '12px 20px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#1a2426', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.item}</div>
                      <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8a9699', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.marca ? `${e.un} · ${e.marca}` : e.un}</div>
                    </div>
                    <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>{e.cat}</span>
                    <span className="tnum" style={{ font: "800 13px 'Plus Jakarta Sans'", color: st.qty, textAlign: 'right' }}>{e.qtd}</span>
                    <span className="tnum" style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699', textAlign: 'right' }}>{e.min}</span>
                    <span className="tnum" style={{ font: "700 12px 'Plus Jakarta Sans'", color: e.valor ? '#1a2426' : '#c4ccce', textAlign: 'right' }}>{e.valor ? `R$ ${e.valor}` : '—'}</span>
                    {(() => {
                      if (!e.validade) return <span className="tnum" style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#c4ccce' }}>—</span>
                      const dias = diasValidade(e.validade)
                      const color = dias < 0 ? '#a81e1e' : dias <= 60 ? '#9a5a06' : '#5b6a6d'
                      return (
                        <span title={e.lote ? `Lote ${e.lote}` : undefined}>
                          <span className="tnum" style={{ display: 'block', font: "600 12px 'Plus Jakarta Sans'", color }}>{brDate(e.validade)}</span>
                          {dias < 0 && <span style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#a81e1e' }}>vencido</span>}
                          {dias >= 0 && dias <= 60 && <span style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#9a5a06' }}>vence em {dias}d</span>}
                        </span>
                      )
                    })()}
                    <span className="tnum" style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>{e.ent}</span>
                    <span style={{ textAlign: 'right' }}>
                      <span className="pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Menu width={200} items={[
                        { label: 'Editar item', onClick: () => setEditing(e) },
                        { label: 'Registrar saída', onClick: () => setSaida({ item: e, qtd: '1' }) },
                        { label: 'Excluir', danger: true, onClick: () => setConfirmDel(e) },
                      ]} />
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
            <div className="card" style={{ padding: '16px 18px', flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#1a2426', marginBottom: 8 }}>Movimentações recentes</div>
              {movimentos.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699', padding: '10px 0' }}>Nenhuma movimentação ainda.</div>}
              {movimentos.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid #f4f6f6' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: m.kind === 'entrada' ? '#16a34a' : '#d97706' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#1a2426' }}>{m.tipo} · {m.desc}</div>
                    <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8a9699' }}>{m.when}</div>
                  </div>
                  <span className="tnum" style={{ font: "800 12px 'Plus Jakarta Sans'", color: m.kind === 'entrada' ? '#127436' : '#9a5a06' }}>{m.delta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
            placeholder="Ex.: Resina composta A2"
            emptyText="Fora do catálogo — será um material novo."
            onChange={(v) => {
              const hit = catalog.find((c) => c.item.toLowerCase() === v.toLowerCase())
              setForm(hit ? { ...form, item: v, cat: hit.cat, un: hit.un, min: String(hit.min) } : { ...form, item: v })
            }}
          />
        </Field>
        <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginTop: -6 }}>
          Comece a digitar — o catálogo preenche categoria, unidade e mínimo automaticamente.
        </div>
        <FieldRow>
          <Field label="Categoria">
            <TextInput value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="Ex.: Restauradores" />
          </Field>
          <Field label="Unidade">
            <TextInput value={form.un} onChange={(e) => setForm({ ...form, un: e.target.value })} placeholder="Ex.: seringas" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Quantidade">
            <TextInput type="number" value={form.qtd} onChange={(e) => setForm({ ...form, qtd: e.target.value })} placeholder="Ex.: 10" />
          </Field>
          <Field label="Mínimo">
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
              <Field label="Categoria"><TextInput value={editing.cat} onChange={(e) => setEditing({ ...editing, cat: e.target.value })} /></Field>
              <Field label="Unidade"><TextInput value={editing.un} onChange={(e) => setEditing({ ...editing, un: e.target.value })} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Quantidade"><TextInput type="number" value={editing.qtd} onChange={(e) => setEditing({ ...editing, qtd: e.target.value })} /></Field>
              <Field label="Mínimo"><TextInput type="number" value={editing.min} onChange={(e) => setEditing({ ...editing, min: e.target.value })} /></Field>
            </FieldRow>
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
            <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>Em estoque: <b style={{ color: '#26324a' }}>{saida.item.qtd} {saida.item.un}</b></div>
            <Field label="Quantidade a retirar"><TextInput type="number" autoFocus value={saida.qtd} onChange={(e) => setSaida({ ...saida, qtd: e.target.value })} /></Field>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => { if (confirmDel) { deleteEstoque(confirmDel.item); toast('Item excluído.') } }}
        title="Excluir item" message={`Remover ${confirmDel?.item ?? ''} do estoque?`} />
    </>
  )
}
