import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../icons'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, FieldRow } from '../components/Field'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/States'
import { useToast } from '../components/Toast'
import { SuggestInput } from '../components/SuggestInput'
import { useStore, type Procedimento } from '../store'
import type { BOMLine } from '../lib/bom'
import { fmtMoney, parseMoney } from '../lib/fmt'

const GRID = '1.6fr 0.7fr 1fr 34px'
const NOVO_EMPTY = { proc: '', cat: '', dur: '', val: '' }

export default function FichaProcedimento() {
  const { procedimentos, estoque, addProcedimento, updateProcedimento, deleteProcedimento } = useStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState<string | null>(procedimentos[0]?.id ?? null)
  const [novo, setNovo] = useState(false)
  const [form, setForm] = useState(NOVO_EMPTY)
  const [confirmDel, setConfirmDel] = useState<Procedimento | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return procedimentos
    return procedimentos.filter((p) => p.proc.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q))
  }, [query, procedimentos])

  const sel = useMemo(() => procedimentos.find((p) => p.id === selId) ?? null, [procedimentos, selId])

  // mantém uma seleção válida quando a lista muda
  useEffect(() => {
    if ((!selId || !procedimentos.some((p) => p.id === selId)) && procedimentos.length > 0) setSelId(procedimentos[procedimentos.length - 1].id)
    if (procedimentos.length === 0) setSelId(null)
  }, [procedimentos, selId])

  // texto do campo Valor (permite digitar vírgula à vontade; o número parseado é salvo)
  const [valText, setValText] = useState('')
  useEffect(() => {
    const cur = procedimentos.find((p) => p.id === selId)
    setValText(cur && cur.val ? String(cur.val).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  const setLine = (idx: number, patch: Partial<BOMLine>) => {
    if (!sel) return
    updateProcedimento(sel.id, { lines: sel.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) })
  }
  const addLine = () => sel && updateProcedimento(sel.id, { lines: [...sel.lines, { item: '', qtd: 1, label: '' }] })
  const removeLine = (idx: number) => sel && updateProcedimento(sel.id, { lines: sel.lines.filter((_, i) => i !== idx) })

  const criar = () => {
    const nome = form.proc.trim()
    if (!nome) { toast('Informe o nome do procedimento.', 'error'); return }
    const id = addProcedimento({ proc: nome, cat: form.cat.trim() || 'Geral', durMin: Number(form.dur) || 30, val: parseMoney(form.val), lines: [] })
    setSelId(id)
    setNovo(false)
    setForm(NOVO_EMPTY)
    toast('Procedimento criado.')
  }

  return (
    <>
      <header className="topbar">
        <h1 className="topbar-title">Ficha de Procedimento</h1>
        <div className="topbar-actions">
          <label className="searchbox" style={{ width: 260 }}>
            <Icon name="search" size={18} />
            <input placeholder="Buscar procedimento…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <Button icon={<Icon name="plus" size={17} />} onClick={() => { setForm(NOVO_EMPTY); setNovo(true) }}>
            Novo procedimento
          </Button>
        </div>
      </header>

      <div className="page-body split-nav" style={{ '--nav': '320px' } as React.CSSProperties}>
        {/* Lista de procedimentos */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 12px', font: "800 15px var(--font)", color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>
            Procedimentos & preços
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {list.length === 0 && <div style={{ font: "600 12px var(--font)", color: 'var(--muted)', padding: '12px 10px' }}>Nenhum procedimento. Clique em “Novo procedimento”.</div>}
            {list.map((p) => {
              const active = p.id === selId
              return (
                <button
                  key={p.id}
                  onClick={() => setSelId(p.id)}
                  style={{
                    display: 'flex', width: '100%', textAlign: 'left', gap: 10, alignItems: 'center', padding: '10px 12px', marginBottom: 2,
                    borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--slate)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 12.5px var(--font)", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.proc}</div>
                    <div style={{ font: "600 11px var(--font)", color: active ? 'rgba(255,255,255,.75)' : 'var(--muted)' }}>{p.cat} · {p.lines.length} materia{p.lines.length === 1 ? 'l' : 'is'}</div>
                  </div>
                  <span className="tnum" style={{ font: "700 12px var(--font)", flex: 'none', color: active ? '#fff' : 'var(--ink)' }}>{fmtMoney(p.val)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Procedimento selecionado — editável */}
        {!sel ? (
          <div className="card" style={{ display: 'flex' }}>
            <EmptyState icon="clipboard" title="Nenhum procedimento selecionado" desc="Crie um procedimento ou selecione um na lista ao lado." action={<Button icon={<Icon name="plus" size={17} />} onClick={() => setNovo(true)}>Novo procedimento</Button>} />
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                value={sel.proc}
                onChange={(e) => updateProcedimento(sel.id, { proc: e.target.value })}
                placeholder="Nome do procedimento"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: "800 16px var(--font)", color: 'var(--ink)' }}
              />
              <button className="icon-btn" title="Excluir procedimento" onClick={() => setConfirmDel(sel)}
                style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--red-bg)', border: 'none', color: 'var(--danger-text)', cursor: 'pointer' }}>
                <Icon name="trash" size={17} />
              </button>
            </div>

            {/* Preços / dados do procedimento */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <FieldRow>
                <Field label="Categoria"><TextInput value={sel.cat} onChange={(e) => updateProcedimento(sel.id, { cat: e.target.value })} placeholder="Ex.: Dentística" /></Field>
                <Field label="Duração (min)"><TextInput type="number" min={5} step={5} value={String(sel.durMin || '')} onChange={(e) => updateProcedimento(sel.id, { durMin: Math.max(0, Number(e.target.value) || 0) })} placeholder="Ex.: 40" /></Field>
                <Field label="Valor (R$)"><TextInput inputMode="decimal" value={valText} onChange={(e) => { setValText(e.target.value); updateProcedimento(sel.id, { val: parseMoney(e.target.value) }) }} placeholder="Ex.: 180,00" /></Field>
              </FieldRow>
            </div>

            <div style={{ font: "600 11.5px var(--font)", color: 'var(--muted)', padding: '12px 20px 4px' }}>Ficha técnica — materiais consumidos a cada execução</div>

            <div className="table-x" style={{ '--table-min': '520px' } as React.CSSProperties}>
            <div className="table-head" style={{ gridTemplateColumns: GRID, gap: 14, padding: '8px 20px' }}>
              <span>MATERIAL</span>
              <span style={{ textAlign: 'right' }}>CONSUMO</span>
              <span>RÓTULO EXIBIDO</span>
              <span />
            </div>

            <div className="table-body">
              {sel.lines.length === 0 && (
                <div style={{ font: "600 12px var(--font)", color: 'var(--muted)', padding: '14px 20px' }}>
                  Nenhum material. Clique em “Adicionar material”.
                </div>
              )}
              {sel.lines.map((l, idx) => {
                const stock = estoque.find((e) => e.item.toLowerCase() === l.item.trim().toLowerCase())
                return (
                  <div key={idx} className="table-row" style={{ gridTemplateColumns: GRID, gap: 14, padding: '9px 20px', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <SuggestInput
                        value={l.item}
                        options={estoque.map((e) => ({ value: e.item, sub: `${e.cat || 'Estoque'} · saldo ${e.qtd} ${e.un}` }))}
                        placeholder="Ex.: Resina composta A2"
                        emptyText="Sem correspondência no estoque."
                        onChange={(v) => setLine(idx, { item: v })}
                      />
                      <div style={{ font: "600 10.5px var(--font)", color: stock ? 'var(--green-dark)' : 'var(--amber-dark)', marginTop: 3 }}>
                        {stock ? `saldo: ${stock.qtd} ${stock.un}` : l.item.trim() ? 'não cadastrado no estoque' : ' '}
                      </div>
                    </div>
                    <TextInput type="number" min={0} value={String(l.qtd)} onChange={(e) => setLine(idx, { qtd: Number(e.target.value) || 0 })} style={{ textAlign: 'right' }} />
                    <TextInput value={l.label} onChange={(e) => setLine(idx, { label: e.target.value })} placeholder="Ex.: 1 tubete" />
                    <button className="icon-btn" title="Remover material" onClick={() => removeLine(idx)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer' }}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
              <Button variant="outline" icon={<Icon name="plus" size={16} />} onClick={addLine}>Adicionar material</Button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary-dark)' }}>
                <Icon name="box" size={15} />
                <span style={{ font: "600 11.5px var(--font)", color: 'var(--primary-dark)' }}>Baixa automática no estoque ao concluir o atendimento.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Novo procedimento */}
      <Modal open={novo} onClose={() => setNovo(false)} title="Novo procedimento" subtitle="Preço e ficha técnica ficam nesta aba" width={460}
        footer={<><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Criar</Button></>}>
        <Field label="Procedimento">
          <TextInput autoFocus value={form.proc} onChange={(e) => setForm({ ...form, proc: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') criar() }} placeholder="Ex.: Clareamento dental" />
        </Field>
        <FieldRow>
          <Field label="Categoria"><TextInput value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="Ex.: Estética" /></Field>
          <Field label="Duração (min)"><TextInput type="number" min={5} step={5} value={form.dur} onChange={(e) => setForm({ ...form, dur: e.target.value })} placeholder="Ex.: 40" /></Field>
        </FieldRow>
        <Field label="Valor (R$)"><TextInput inputMode="decimal" value={form.val} onChange={(e) => setForm({ ...form, val: e.target.value })} placeholder="Ex.: 180,00" /></Field>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)}
        onConfirm={() => { if (confirmDel) { deleteProcedimento(confirmDel.id); toast('Procedimento excluído.') } }}
        title="Excluir procedimento" message={`Remover “${confirmDel?.proc ?? ''}” (preço e ficha técnica)?`} />
    </>
  )
}
