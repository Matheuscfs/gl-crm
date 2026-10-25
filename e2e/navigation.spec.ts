import { expect, test } from './fixtures'

const SECTIONS: [path: string, label: string][] = [
  ['/agenda', 'Agenda'],
  ['/pacientes', 'Pacientes'],
  ['/crm', 'Relacionamento'],
  ['/financeiro', 'Financeiro'],
  ['/estoque', 'Estoque'],
  ['/ficha-procedimento', 'Procedimentos'],
  ['/relatorios', 'Relatórios'],
  ['/configuracoes', 'Configurações'],
]

test('the home page greets the dentist and lists who to call first', async ({ page, consoleErrors }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bom dia, Dra. Gabriela')
  await expect(page.getByText('Modo demonstração')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Alice Ferreira' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

for (const [path, label] of SECTIONS) {
  test(`${label} opens from the side menu with its own title`, async ({ page, consoleErrors }) => {
    await page.goto('/')
    await page.locator(`aside a[href="${path}"], nav a[href="${path}"]`).first().click()
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('navigation', { name: 'Você está em' }).locator('[aria-current="page"]')).toHaveText(label)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })
}

test('the patient record shows the patient name in the breadcrumb, not the id', async ({ page }) => {
  await page.goto('/pacientes/seed-p2')
  await expect(page).toHaveURL(/\/pacientes\/seed-p2\/odontograma$/)
  const crumb = page.getByRole('navigation', { name: 'Você está em' })
  await expect(crumb.locator('[aria-current="page"]')).toHaveText('Bento Correia')
  await expect(crumb).not.toContainText('seed-p2')
  await expect(page.getByRole('heading', { level: 1, name: 'Bento Correia' })).toBeVisible()
})

test('Ctrl+K finds a patient and opens the record', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Control+k')
  await expect(page.getByPlaceholder('Buscar paciente…')).toBeFocused()
  await page.keyboard.type('bento')
  await page.getByRole('button', { name: /Bento Correia/ }).click()
  await expect(page).toHaveURL(/\/pacientes\/seed-p2\//)
  await expect(page.getByRole('heading', { level: 1, name: 'Bento Correia' })).toBeVisible()
})
