import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { BRAND } from '../brand'

/** Dados do emissor que saem nos documentos (recibo, orçamento, receita, atestado). */
export interface ClinicInfo {
  name: string
  /** Quem assina os documentos e a linha abaixo do nome. */
  profissional: string
  especialidade: string
  cro: string
  cnpj: string
  /** CPF da profissional — usado no recibo e no Carnê-Leão. */
  cpf: string
  address: string
  /** Cidade e UF separadas (o PIX e a data dos documentos usam a cidade). */
  cidade: string
  uf: string
  phone: string
}

export interface ClinicSettings extends ClinicInfo {
  pixKey: string
}

const [cidadeBrand, ufBrand] = BRAND.city.split('-').map((s) => s.trim())

export const CLINIC_FALLBACK: ClinicSettings = {
  name: BRAND.clinic,
  profissional: BRAND.dentist,
  especialidade: 'Cirurgiã Dentista',
  cro: BRAND.cro,
  cnpj: '',
  cpf: '',
  address: '',
  cidade: cidadeBrand ?? '',
  uf: ufBrand ?? '',
  phone: '',
  pixKey: '',
}

/** "Cascavel-PR" para cabeçalhos e datas de documentos. */
export const cidadeUf = (c: Pick<ClinicInfo, 'cidade' | 'uf'>) => [c.cidade, c.uf].filter(Boolean).join('-')

// uma leitura por sessão: vários documentos na mesma tela compartilham a mesma resposta
let cache: Promise<ClinicSettings> | null = null
function carregar(): Promise<ClinicSettings> {
  if (!supabase) return Promise.resolve(CLINIC_FALLBACK)
  cache ??= Promise.resolve(supabase.from('clinic_settings').select('*').maybeSingle()).then(({ data, error }) => {
    if (error || !data) { cache = null; return CLINIC_FALLBACK }
    return {
      name: (data.name as string) || BRAND.clinic,
      profissional: (data.profissional as string) || CLINIC_FALLBACK.profissional,
      especialidade: (data.especialidade as string) || CLINIC_FALLBACK.especialidade,
      cro: (data.cro as string) || BRAND.cro,
      cnpj: (data.cnpj as string) ?? '',
      cpf: (data.cpf as string) ?? '',
      address: (data.address as string) ?? '',
      cidade: (data.cidade as string) || cidadeBrand || '',
      uf: (data.uf as string) || ufBrand || '',
      phone: (data.phone as string) ?? '',
      pixKey: (data.pix_key as string) ?? '',
    }
  })
  return cache
}

/** Depois de salvar em Configurações, a próxima leitura busca de novo. */
export function invalidarClinic() { cache = null }

/** Perfil da clínica (Configurações). Cai no BRAND quando o banco não responde. */
export function useClinic(): ClinicSettings {
  const [clinic, setClinic] = useState<ClinicSettings>(CLINIC_FALLBACK)
  useEffect(() => {
    let cancelled = false
    carregar().then((c) => { if (!cancelled) setClinic(c) })
    return () => { cancelled = true }
  }, [])
  return clinic
}
