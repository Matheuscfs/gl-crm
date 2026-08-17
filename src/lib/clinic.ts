import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { BRAND } from '../brand'

/** Dados do emissor que saem nos documentos (recibo, orçamento). */
export interface ClinicInfo {
  name: string
  cro: string
  cnpj: string
  /** CPF da profissional — usado no recibo e no Carnê-Leão. */
  cpf: string
  address: string
}

export interface ClinicSettings extends ClinicInfo {
  pixKey: string
}

export const CLINIC_FALLBACK: ClinicSettings = {
  name: BRAND.clinic,
  cro: BRAND.cro,
  cnpj: '',
  cpf: '',
  address: BRAND.city,
  pixKey: '',
}

/** Perfil da clínica (Configurações). Cai no BRAND quando o banco não responde. */
export function useClinic(): ClinicSettings {
  const [clinic, setClinic] = useState<ClinicSettings>(CLINIC_FALLBACK)
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('clinic_settings').select('*').maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setClinic({
        name: (data.name as string) || BRAND.clinic,
        cro: (data.cro as string) || BRAND.cro,
        cnpj: (data.cnpj as string) ?? '',
        cpf: (data.cpf as string) ?? '',
        address: (data.address as string) || BRAND.city,
        pixKey: (data.pix_key as string) ?? '',
      })
    })
    return () => { cancelled = true }
  }, [])
  return clinic
}
