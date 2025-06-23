import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display main heading and hero content', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /policydiff/i })).toBeVisible()
    await expect(page.getByText(/track privacy policy changes/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible()
  })

  test('should display company grid', async ({ page }) => {
    // Mock companies API
    await page.route('**/api/companies**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              slug: 'google',
              name: 'Google',
              url: 'https://policies.google.com/privacy',
              lastChecked: '2024-01-15T10:00:00Z',
              status: 'active'
            },
            {
              slug: 'facebook',
              name: 'Facebook',
              url: 'https://www.facebook.com/privacy/explanation',
              lastChecked: '2024-01-14T15:30:00Z',
              status: 'active'
            }
          ]
        })
      })
    })

    await page.reload()
    
    await expect(page.getByText('Google')).toBeVisible()
    await expect(page.getByText('Facebook')).toBeVisible()
  })

  test('should navigate to company page when clicking company card', async ({ page }) => {
    // Mock companies API
    await page.route('**/api/companies**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              slug: 'google',
              name: 'Google',
              url: 'https://policies.google.com/privacy',
              lastChecked: '2024-01-15T10:00:00Z',
              status: 'active'
            }
          ]
        })
      })
    })

    await page.reload()
    await page.getByText('Google').click()
    
    await expect(page).toHaveURL('/google')
  })

  test('should display search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search companies/i)
    await expect(searchInput).toBeVisible()
    
    // Test search functionality
    await searchInput.fill('Google')
    await expect(searchInput).toHaveValue('Google')
  })

  test('should display navigation menu', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /companies/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /about/i })).toBeVisible()
  })

  test('should handle mobile navigation', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Mobile menu button should be visible
    const mobileMenuButton = page.getByRole('button', { name: /menu/i })
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click()
      await expect(page.getByRole('navigation')).toBeVisible()
    }
  })

  test('should display footer', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(page.getByText(/© 2024/i)).toBeVisible()
  })

  test('should handle loading states', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/companies**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      })
    })

    await page.reload()
    
    // Should show loading spinner
    await expect(page.getByTestId('loading-spinner')).toBeVisible()
  })

  test('should handle error states', async ({ page }) => {
    // Mock API error
    await page.route('**/api/companies**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      })
    })

    await page.reload()
    
    // Should show error message
    await expect(page.getByText(/error loading/i)).toBeVisible()
  })

  test('should be responsive', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 768, height: 1024 }, // iPad
      { width: 1024, height: 768 }, // Desktop small
      { width: 1920, height: 1080 } // Desktop large
    ]

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      
      // Main content should be visible at all sizes
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByRole('heading', { name: /policydiff/i })).toBeVisible()
    }
  })

  test('should have proper SEO elements', async ({ page }) => {
    await expect(page).toHaveTitle(/PolicyDiff/i)
    
    const metaDescription = page.locator('meta[name="description"]')
    await expect(metaDescription).toHaveAttribute('content', /.+/)
    
    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute('content', /.+/)
  })
})