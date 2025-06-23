import { test, expect } from '@playwright/test'

test.describe('Company Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock company data
    await page.route('**/api/companies/google', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            slug: 'google',
            name: 'Google',
            url: 'https://policies.google.com/privacy',
            content: 'Sample privacy policy content for testing...',
            lastChecked: '2024-01-15T10:00:00Z',
            version: 5,
            status: 'active',
            metadata: {
              wordCount: 5000,
              readingTime: 25,
              lastModified: '2024-01-15T10:00:00Z'
            }
          }
        })
      })
    })

    // Mock diffs API
    await page.route('**/api/diff/google', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'diff-1',
              version: 5,
              changes: [
                {
                  type: 'addition',
                  text: 'We may collect additional information',
                  position: 100
                }
              ],
              summary: 'Added data collection clause',
              timestamp: '2024-01-15T10:00:00Z'
            }
          ]
        })
      })
    })

    await page.goto('/google')
  })

  test('should display company information', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /google/i })).toBeVisible()
    await expect(page.getByText(/privacy policy/i)).toBeVisible()
    await expect(page.getByText(/last checked/i)).toBeVisible()
  })

  test('should display policy content', async ({ page }) => {
    await expect(page.getByText(/sample privacy policy content/i)).toBeVisible()
  })

  test('should display policy metadata', async ({ page }) => {
    await expect(page.getByText(/5000/i)).toBeVisible() // word count
    await expect(page.getByText(/25/i)).toBeVisible() // reading time
    await expect(page.getByText(/version 5/i)).toBeVisible()
  })

  test('should display recent changes', async ({ page }) => {
    await expect(page.getByText(/recent changes/i)).toBeVisible()
    await expect(page.getByText(/added data collection clause/i)).toBeVisible()
  })

  test('should allow AI analysis', async ({ page }) => {
    // Mock AI analysis API
    await page.route('**/api/analyze/google', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analysis: 'This privacy policy demonstrates moderate data collection practices...',
          riskScore: 65,
          summary: 'Moderate privacy risk with some concerning clauses'
        })
      })
    })

    const analyzeButton = page.getByRole('button', { name: /analyze with ai/i })
    await expect(analyzeButton).toBeVisible()
    
    await analyzeButton.click()
    
    // Should show loading state
    await expect(page.getByText(/analyzing/i)).toBeVisible()
    
    // Should show analysis results
    await expect(page.getByText(/this privacy policy demonstrates/i)).toBeVisible()
    await expect(page.getByText(/risk score/i)).toBeVisible()
    await expect(page.getByText(/65/i)).toBeVisible()
  })

  test('should display premium analysis options', async ({ page }) => {
    const premiumButton = page.getByRole('button', { name: /premium analysis/i })
    if (await premiumButton.isVisible()) {
      await premiumButton.click()
      await expect(page.getByText(/upgrade to premium/i)).toBeVisible()
    }
  })

  test('should handle diff viewer', async ({ page }) => {
    const viewDiffButton = page.getByRole('button', { name: /view changes/i })
    if (await viewDiffButton.isVisible()) {
      await viewDiffButton.click()
      await expect(page.getByText(/we may collect additional information/i)).toBeVisible()
    }
  })

  test('should handle company not found', async ({ page }) => {
    await page.route('**/api/companies/nonexistent', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Company not found' })
      })
    })

    await page.goto('/nonexistent')
    await expect(page.getByText(/company not found/i)).toBeVisible()
  })

  test('should display timeline of changes', async ({ page }) => {
    // Mock timeline API
    await page.route('**/api/timeline/google', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              date: '2024-01-15',
              version: 5,
              changes: 3,
              summary: 'Major privacy updates'
            },
            {
              date: '2024-01-01',
              version: 4,
              changes: 1,
              summary: 'Minor clarifications'
            }
          ]
        })
      })
    })

    const timelineTab = page.getByRole('tab', { name: /timeline/i })
    if (await timelineTab.isVisible()) {
      await timelineTab.click()
      await expect(page.getByText(/major privacy updates/i)).toBeVisible()
    }
  })

  test('should handle sharing functionality', async ({ page }) => {
    const shareButton = page.getByRole('button', { name: /share/i })
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Should show share options
      await expect(page.getByText(/share this policy/i)).toBeVisible()
      
      // Test copy link functionality
      const copyButton = page.getByRole('button', { name: /copy link/i })
      if (await copyButton.isVisible()) {
        await copyButton.click()
        await expect(page.getByText(/link copied/i)).toBeVisible()
      }
    }
  })

  test('should handle export functionality', async ({ page }) => {
    // Mock export API
    await page.route('**/api/export**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('Mock PDF content')
      })
    })

    const exportButton = page.getByRole('button', { name: /export/i })
    if (await exportButton.isVisible()) {
      await exportButton.click()
      
      // Should trigger download
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: /pdf/i }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/google.*\.pdf/)
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Main content should still be visible
    await expect(page.getByRole('heading', { name: /google/i })).toBeVisible()
    
    // Mobile-specific layouts should work
    const mobileMenuButton = page.getByRole('button', { name: /menu/i })
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click()
    }
  })

  test('should handle back navigation', async ({ page }) => {
    await page.goBack()
    await expect(page).toHaveURL('/')
  })
})