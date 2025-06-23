import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login form', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).click()
    
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('should display signup form', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click()
    
    await expect(page).toHaveURL('/signup')
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('should validate login form', async ({ page }) => {
    await page.goto('/login')
    
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click()
    
    await expect(page.getByText(/email is required/i)).toBeVisible()
    await expect(page.getByText(/password is required/i)).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('invalid-email')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /sign in/i }).click()
    
    await expect(page.getByText(/please enter a valid email/i)).toBeVisible()
  })

  test('should handle login error', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('nonexistent@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 10000 })
  })

  test('should navigate between login and signup', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByRole('link', { name: /don't have an account/i }).click()
    await expect(page).toHaveURL('/signup')
    
    await page.getByRole('link', { name: /already have an account/i }).click()
    await expect(page).toHaveURL('/login')
  })

  test('should redirect to onboarding after successful signup', async ({ page }) => {
    // Mock successful signup by intercepting API calls
    await page.route('**/api/auth/signup', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          user: { id: 'test-id', email: 'test@example.com' } 
        })
      })
    })

    await page.goto('/signup')
    
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /create account/i }).click()
    
    await expect(page).toHaveURL('/onboarding')
  })

  test('should show loading state during authentication', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/auth/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' })
      })
    })

    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // Should show loading state
    await expect(page.getByText(/signing in/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })
})