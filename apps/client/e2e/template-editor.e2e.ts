import { test, expect } from '@playwright/test'

// «Ольга без SQL» — the acceptance scenario for the template editor
// (specs/features/template-editor/validation.md, interview Q9).
//
// Needs a real signed-in admin (Supabase Auth) + a template-mode service, so it
// runs on Sergey's machine (env below) — NOT in CI/container without creds:
//   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD  — admin login
//   E2E_SERVICE_ID                        — id of a template-mode service (e.g. divorce)
const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD
const SERVICE_ID = process.env.E2E_SERVICE_ID

test.describe('template editor — «Ольга без SQL»', () => {
  test.skip(!EMAIL || !PASSWORD || !SERVICE_ID, 'E2E_ADMIN_* env not set — run locally with creds')

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(EMAIL!)
    await page.getByLabel(/пароль/i).fill(PASSWORD!)
    await page.getByRole('button', { name: /увійти/i }).click()
    await page.waitForURL('**/services')
    await page.goto(`/services/${SERVICE_ID}/edit`)
    await page.getByRole('button', { name: /Шаблон документа|Шаблон/ }).click()
  })

  test('style buttons take effect in the layout preview and publish succeeds', async ({ page }) => {
    const textarea = page.getByRole('textbox')

    // 1. Right-align the date line: caret into the textarea, click «Праворуч».
    await textarea.click()
    await page.getByRole('button', { name: 'Праворуч' }).click()
    await expect(textarea).toHaveValue(/\{\{!style: right\}\}/)

    // 2. «Додатки» from a new page.
    await page.getByRole('button', { name: 'З нової сторінки' }).click()
    await expect(textarea).toHaveValue(/\{\{!style: page-break-before\}\}/)

    // 3. Layout preview reflects the draft (A4 pages render).
    await page.getByRole('button', { name: 'Розкладка' }).click()
    await expect(page.getByText(/Так документ лягає по сторінках A4/)).toBeVisible()

    // 4. Publish: gate passes → success toast; revision row is written server-side.
    await page.getByRole('button', { name: 'Опублікувати' }).click()
    await expect(page.getByText(/Опубліковано/)).toBeVisible()
  })

  test('a broken template blocks publish with a Ukrainian error; draft still saves', async ({ page }) => {
    const textarea = page.getByRole('textbox')
    await textarea.fill('Текст\n{{#if has_children}}\nбез закриття')

    await expect(page.getByRole('alert')).toContainText('Помилка в шаблоні')
    await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeDisabled()

    await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
    await expect(page.getByText(/Чернетку збережено/)).toBeVisible()
  })
})
