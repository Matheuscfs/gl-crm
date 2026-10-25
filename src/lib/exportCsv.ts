/* Exportação de CSV real (download de blob) — compatível com Excel pt-BR (separador ';'). */

function escapeCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  // injeção de fórmula: texto vindo do cadastro como "=HYPERLINK(...)" executaria no Excel
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  // aspas duplas escapadas; envolve em aspas se tiver ; " ou quebra de linha
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Gera e baixa um CSV a partir de um cabeçalho e linhas.
 * @param filename nome do arquivo (sem extensão)
 * @param headers rótulos das colunas
 * @param rows matriz de valores (mesma ordem dos headers)
 */
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const sep = ';'
  const lines = [headers.map(escapeCell).join(sep), ...rows.map((r) => r.map(escapeCell).join(sep))]
  // BOM para o Excel reconhecer UTF-8 (acentuação)
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
