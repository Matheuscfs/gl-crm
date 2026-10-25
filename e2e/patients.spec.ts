import { expect, test } from './fixtures'

test.describe('new patient', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pacientes')
    await page.getByRole('button', { name: 'Novo paciente' }).click()
  })

  test('is registered through the three steps and shows up in the list and in search', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' })
    await dialog.getByRole('textbox', { name: 'Nome da criança' }).fill('Lia Teste')
    await dialog.getByRole('textbox', { name: /Data de nascimento/ }).fill('10/03/2019')
    await expect(dialog.getByRole('textbox', { name: 'Idade (calculada)' })).toHaveValue('7a 7m')
    await dialog.getByRole('textbox', { name: 'CPF' }).fill('52998224725')
    await expect(dialog.getByRole('textbox', { name: 'CPF' })).toHaveValue('529.982.247-25')
    await dialog.getByRole('button', { name: 'Avançar' }).click()

    await expect(dialog).toContainText('Etapa 2 de 3 · Responsáveis')
    await dialog.getByRole('textbox', { name: 'Nome (principal)' }).fill('Paula Teste')
    await dialog.getByRole('textbox', { name: 'Telefone' }).fill('45984157928')
    await expect(dialog.getByRole('textbox', { name: 'Telefone' })).toHaveValue('(45) 98415-7928')
    await dialog.getByRole('button', { name: 'Avançar' }).click()

    await expect(dialog).toContainText('Etapa 3 de 3 · Detalhes finais')
    await expect(dialog).toContainText('Lia Teste · Pediátrico · Particular · 7a 7m')
    await dialog.getByRole('button', { name: 'Salvar paciente' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText('10 pacientes', { exact: false })).toBeVisible()
    await page.getByRole('textbox', { name: 'Buscar paciente', exact: true }).fill('Lia')
    await expect(page.getByRole('link', { name: 'Lia Teste' })).toBeVisible()
  })

  test('stops on step one when the CPF check digits are wrong', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' })
    await dialog.getByRole('textbox', { name: 'Nome da criança' }).fill('Lia Teste')
    await dialog.getByRole('textbox', { name: /Data de nascimento/ }).fill('10/03/2019')
    await dialog.getByRole('textbox', { name: 'CPF' }).fill('52998224724')
    await dialog.getByRole('button', { name: 'Avançar' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'CPF inválido.' })).toBeVisible()
    await expect(dialog).toContainText('Etapa 1 de 3')
  })

  test('asks for the birth date before moving on', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' })
    await dialog.getByRole('textbox', { name: 'Nome da criança' }).fill('Lia Teste')
    await dialog.getByRole('button', { name: 'Avançar' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Informe a data de nascimento.' })).toBeVisible()
    await expect(dialog).toContainText('Etapa 1 de 3')
  })
})

test('the overdue-recall filter lists only patients past their recall date', async ({ page }) => {
  await page.goto('/pacientes?filtro=vencidos')
  await expect(page.getByRole('link', { name: 'Alice Ferreira' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Miguel Andrade' })).toBeHidden()
})
