import { supabase } from './supabase'

/**
 * Dados de DEMONSTRAÇÃO (pacientes, agenda, leads, parcelas e movimentações fictícios).
 *
 * Ligados apenas quando o Supabase não está configurado — aí as telas mostram o
 * protótipo em vez de ficarem vazias. Com banco configurado o app mostra só o que
 * está gravado: tela vazia significa "ainda não tem dado", não "sumiu".
 *
 * Para rever a demo com o banco ligado, use VITE_DEMO_DATA=1 no .env.
 *
 * NÃO são demonstração (continuam sempre carregados, são cadastro de verdade):
 * inventário do estoque, catálogo de materiais, tabela de procedimentos e horários.
 */
export const DEMO_DATA = !supabase || import.meta.env.VITE_DEMO_DATA === '1'
