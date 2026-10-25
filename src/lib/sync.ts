import { supabase } from './supabase'
import { toastGlobal } from '../components/Toast'

/*
 * Gravação no Supabase com três garantias:
 * 1. Toda operação devolve se o banco aceitou (a tela só diz "salvo" depois disso).
 * 2. Registro recém-criado tem id provisório ("tmp…"): edições e exclusões feitas antes de o id
 *    real chegar entram numa fila e são aplicadas assim que ele chega — antes eram perdidas.
 * 3. Leitura paginada: o PostgREST devolve no máximo 1000 linhas por pedido.
 * Sem Supabase configurado (modo demonstração) tudo responde "ok" sem tocar em rede.
 */

/** Recursos do banco detectados na carga (a migração 0026 pode ainda não ter sido aplicada). */
export const esquema = { v26: false }

const reais = new Map<string, string>()
const esperando = new Map<string, Array<(real: string | null) => void>>()

export const ehProvisorio = (id?: string | null) => !id || id.startsWith('tmp') || id.startsWith('seed')

/** Chama `fn` com o id real (na hora, ou quando o insert do provisório terminar). */
function comIdReal(id: string): Promise<string | null> {
  if (!id.startsWith('tmp')) return Promise.resolve(id)
  const real = reais.get(id)
  if (real) return Promise.resolve(real)
  return new Promise((resolve) => {
    const fila = esperando.get(id) ?? []
    fila.push(resolve)
    esperando.set(id, fila)
  })
}

/** O insert do provisório terminou (com o id real, ou null se falhou). */
export function resolverProvisorio(tmp: string, real: string | null) {
  if (real) reais.set(tmp, real)
  esperando.get(tmp)?.forEach((f) => f(real))
  esperando.delete(tmp)
}

/** Id real conhecido para um provisório (para quem guardou o tmp numa rota, por exemplo). */
export const idReal = (id: string) => reais.get(id) ?? id

function avisar(acao: string, tabela: string, msg: string) {
  console.error(`[supabase] ${acao} ${tabela}`, msg)
  toastGlobal(`Não foi possível ${acao} no banco (${tabela}): ${msg}`)
}

const semIndefinidos = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

export async function inserir(tabela: string, valores: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(tabela).insert(semIndefinidos(valores)).select('id').single()
  if (error) { avisar('salvar', tabela, error.message); return null }
  return (data as { id: string }).id
}

export async function atualizar(tabela: string, id: string, patch: Record<string, unknown>): Promise<boolean> {
  if (!supabase || id.startsWith('seed')) return true
  const real = await comIdReal(id)
  if (!real) return false
  const dados = semIndefinidos(patch)
  if (Object.keys(dados).length === 0) return true
  const { error } = await supabase.from(tabela).update(dados).eq('id', real)
  if (error) { avisar('salvar', tabela, error.message); return false }
  return true
}

export async function apagar(tabela: string, id: string): Promise<boolean> {
  if (!supabase || id.startsWith('seed')) return true
  const real = await comIdReal(id)
  if (!real) return true // o insert falhou: não há o que apagar
  const { error } = await supabase.from(tabela).delete().eq('id', real)
  if (error) { avisar('excluir', tabela, error.message); return false }
  return true
}

type Consulta = {
  range: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

/** Lê todas as linhas, de 1000 em 1000. `montar` recria a consulta (com filtros e ordem) a cada página. */
export async function lerTudo<T = Record<string, unknown>>(montar: () => Consulta, tabela: string): Promise<{ data: T[]; error: string | null }> {
  const PAGINA = 1000
  const out: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await montar().range(de, de + PAGINA - 1)
    if (error) { console.error(`[supabase] load ${tabela}`, error.message); return { data: out, error: error.message } }
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  return { data: out, error: null }
}
