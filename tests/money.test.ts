import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMoney, dividirParcelas } from '../src/lib/money.ts'

test('parseMoney entende vírgula, ponto do teclado do tablet e milhar', () => {
  const casos: [string | number, number][] = [
    ['R$ 1.234,56', 1234.56],
    ['180,50', 180.5],
    ['180.50', 180.5], // teclado decimal do tablet — antes virava 18050
    ['180.5', 180.5],
    ['180', 180],
    ['1.234', 1234],
    ['1.234.567,89', 1234567.89],
    ['1,234.56', 1234.56],
    ['0,5', 0.5],
    ['R$ 0,99', 0.99],
    ['-50', -50],
    ['R$ -50,00', -50],
    ['', 0],
    ['abc', 0],
    [99.999, 100],
  ]
  for (const [entrada, esperado] of casos) assert.equal(parseMoney(entrada), esperado, `parseMoney(${JSON.stringify(entrada)})`)
})

test('dividirParcelas fecha o total em centavos', () => {
  assert.deepEqual(dividirParcelas(100, 3), [33.33, 33.33, 33.34])
  assert.equal(dividirParcelas(1234.56, 7).reduce((a, b) => a + b, 0).toFixed(2), '1234.56')
})
