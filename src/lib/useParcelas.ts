import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO_DATA } from './demo'
import { isVencidaBr } from './dates'
import { parseMoney } from './money'
import { parcelas as demoParcelas, type ParcelaStatus } from '../data'

export interface Parcela {
  id: string
  resp: string
  ref: string
  /** "dd/mm/aaaa" */
  venc: string
  val: number
  /** "vencida" é derivado do vencimento — nada grava esse status no banco. */
  status: ParcelaStatus
  patientId?: string
}

const derive = (status: ParcelaStatus, venc: string): ParcelaStatus =>
  status !== 'pago' && isVencidaBr(venc) ? 'vencida' : status

/**
 * Parcelas para os painéis de resumo (Início). `null` enquanto carrega; com erro de rede
 * devolve `erro: true` para a tela dizer "indisponível" em vez de mostrar R$ 0,00.
 */
export function useParcelas(): { parcelas: Parcela[] | null; erro: boolean } {
  const [parcelas, setParcelas] = useState<Parcela[] | null>(() =>
    supabase ? null : DEMO_DATA ? demoParcelas.map((p, i) => ({ id: `demo-${i}`, resp: p.resp, ref: p.ref, venc: p.venc, val: parseMoney(p.val), status: derive(p.status, p.venc) })) : [])
  const [erro, setErro] = useState(false)

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    sb.from('installments').select('id,resp,ref,venc,val,status,patient_id').then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) { setErro(true); setParcelas([]); return }
      setParcelas(data.map((r) => {
        const venc = (r.venc as string) ?? ''
        return {
          id: r.id as string,
          resp: (r.resp as string) ?? '—',
          ref: (r.ref as string) ?? '',
          venc,
          val: parseMoney((r.val as string) ?? ''),
          status: derive(((r.status as ParcelaStatus) ?? 'aberto'), venc),
          patientId: (r.patient_id as string) ?? undefined,
        }
      }))
    })
    return () => { cancelled = true }
  }, [])

  return { parcelas, erro }
}
