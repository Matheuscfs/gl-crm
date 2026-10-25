import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// <option> elements are checked through their `disabled` property: Playwright's toBeDisabled()
// only looks at form controls and buttons.

async function openNewAppointment(page: Page) {
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Novo agendamento' }).click()
  return page.getByRole('dialog', { name: 'Novo agendamento' })
}

test('an appointment booked on a free slot shows up in the week', async ({ page }) => {
  const dialog = await openNewAppointment(page)
  await expect(dialog).toContainText('seg, 26 de outubro')

  await dialog.getByRole('combobox', { name: 'Paciente' }).fill('Lia Teste')
  await dialog.getByRole('combobox', { name: 'Procedimento' }).fill('Profilaxia')
  await dialog.getByRole('textbox', { name: 'Data' }).fill('27/10/2026')
  await dialog.getByRole('combobox', { name: 'Horário' }).selectOption('08:00')
  await dialog.getByRole('button', { name: 'Agendar' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Agendamento criado.' })).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /^08:00 .*Lia Teste/ })).toBeVisible()
})

test('booking on top of another appointment warns about the conflict', async ({ page }) => {
  const dialog = await openNewAppointment(page)
  await dialog.getByRole('combobox', { name: 'Paciente' }).fill('Lia Teste')
  // Théo has a 09:30 appointment on Monday; a one-hour slot at 10:00 overlaps it
  await dialog.getByRole('combobox', { name: 'Horário' }).selectOption('10:00')
  await dialog.getByRole('button', { name: 'Agendar' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'conflito com Théo R. às 09:30' })).toBeVisible()
})

test('slots that would run past closing time cannot be picked', async ({ page }) => {
  const horario = (await openNewAppointment(page)).getByRole('combobox', { name: 'Horário' })
  // Monday closes at 18:00 and the default duration is one hour
  await expect(horario.locator('option', { hasText: '17:00' })).toHaveJSProperty('disabled', false)
  await expect(horario.locator('option', { hasText: '18:00' })).toHaveJSProperty('disabled', true)
})

test('opening hours with a lunch break still allow afternoon bookings', async ({ page }) => {
  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Horários' }).click()
  await page.getByRole('textbox', { name: 'Segunda' }).fill('08:00 – 12:00 / 14:00 – 18:00')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await page.getByRole('link', { name: /Agenda/ }).first().click()
  await page.getByRole('button', { name: 'Novo agendamento' }).click()
  const horario = page.getByRole('dialog', { name: 'Novo agendamento' }).getByRole('combobox', { name: 'Horário' })
  await expect(horario.locator('option', { hasText: '15:00' })).toHaveJSProperty('disabled', false)
  await expect(horario.locator('option', { hasText: '18:00' })).toHaveJSProperty('disabled', true)
})
