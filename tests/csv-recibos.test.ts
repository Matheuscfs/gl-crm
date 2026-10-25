import { describe, expect, test } from 'vitest'
import { toCsv } from '../src/lib/exportCsv.ts'
import { carneLeaoRows, textoReceitaSaude, type Recibo } from '../src/lib/recibos.ts'

describe('toCsv', () => {
  test('uses semicolons and CRLF, the format Excel pt-BR expects', () => {
    expect(toCsv(['Nome', 'Valor'], [['Ana', '150,00'], ['Theo', 80]])).toBe('Nome;Valor\r\nAna;150,00\r\nTheo;80')
  })

  test('quotes cells containing separators, quotes or line breaks', () => {
    expect(toCsv(['Obs'], [['dor; sensibilidade'], ['disse "ok"'], ['linha 1\nlinha 2']])).toBe(
      'Obs\r\n"dor; sensibilidade"\r\n"disse ""ok"""\r\n"linha 1\nlinha 2"',
    )
  })

  test('neutralises text that Excel would run as a formula', () => {
    expect(toCsv(['Nome'], [['=HYPERLINK("http://x","clique")'], ['+5511'], ['@SUM(A1)']])).toBe(
      'Nome\r\n"\'=HYPERLINK(""http://x"",""clique"")"\r\n\'+5511\r\n\'@SUM(A1)',
    )
  })

  test('leaves negative numbers alone', () => {
    expect(toCsv(['Saldo'], [[-50]])).toBe('Saldo\r\n-50')
  })
})

const recibo = (over: Partial<Recibo>): Recibo => ({
  id: 'r1',
  number: 1,
  payerName: 'Carla Souza',
  payerCpf: '529.982.247-25',
  description: 'Profilaxia + flúor',
  value: 180,
  issuedOn: '2026-10-05',
  origin: 'parcela',
  ...over,
})

describe('receipts for the Carnê-Leão export', () => {
  test('sorts by issue date and formats date and value the Brazilian way', () => {
    const rows = carneLeaoRows([
      recibo({ id: 'r2', number: 2, issuedOn: '2026-10-20', value: 1234.5, origin: 'avulso' }),
      recibo({}),
    ])
    expect(rows).toEqual([
      ['05/10/2026', 1, '529.982.247-25', 'Carla Souza', 'Profilaxia + flúor', '180,00', 'Parcela'],
      ['20/10/2026', 2, '529.982.247-25', 'Carla Souza', 'Profilaxia + flúor', '1234,50', 'Avulso'],
    ])
  })

  test('the Receita Saúde text names the patient when someone else pays', () => {
    const texto = textoReceitaSaude(recibo({}), { nome: 'Ana Souza', cpf: '111.444.777-35' })
    expect(texto.split('\n')).toEqual([
      'CPF do pagador: 529.982.247-25',
      'Nome do pagador: Carla Souza',
      'Beneficiário (paciente): Ana Souza · CPF 111.444.777-35',
      'Valor: 180,00',
      'Data do pagamento: 05/10/2026',
      'Descrição: Profilaxia + flúor',
    ])
  })

  test('the Receita Saúde text says the payer is the patient when it is the same person', () => {
    const texto = textoReceitaSaude(recibo({ payerCpf: '', description: '' }), { nome: 'Carla Souza' })
    expect(texto).toContain('CPF do pagador: —')
    expect(texto).toContain('Beneficiário: o próprio pagador')
    expect(texto).toContain('Descrição: serviços odontológicos')
  })
})
