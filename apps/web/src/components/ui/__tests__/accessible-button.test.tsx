import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccessibleButton } from '../accessible-button'

describe('AccessibleButton', () => {
  it('should render with default props', () => {
    render(<AccessibleButton>Click me</AccessibleButton>)
    
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('should apply variant styles', () => {
    const { rerender } = render(
      <AccessibleButton variant="destructive">Delete</AccessibleButton>
    )
    
    let button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground')
    
    rerender(<AccessibleButton variant="outline">Outline</AccessibleButton>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('border', 'border-input')
    
    rerender(<AccessibleButton variant="ghost">Ghost</AccessibleButton>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('hover:bg-accent')
  })

  it('should apply size styles', () => {
    const { rerender } = render(
      <AccessibleButton size="sm">Small</AccessibleButton>
    )
    
    let button = screen.getByRole('button')
    expect(button).toHaveClass('h-8', 'px-3', 'text-xs')
    
    rerender(<AccessibleButton size="lg">Large</AccessibleButton>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('h-10', 'px-8')
  })

  it('should handle loading state', () => {
    render(
      <AccessibleButton loading>
        Save
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getByText('Save')).toHaveClass('opacity-50')
  })

  it('should set custom aria-label when loading', () => {
    render(
      <AccessibleButton loading loadingText="Saving changes...">
        Save
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Saving changes...')
  })

  it('should handle disabled state', () => {
    render(
      <AccessibleButton disabled>
        Disabled
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')
  })

  it('should handle click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(
      <AccessibleButton onClick={handleClick}>
        Click me
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    await user.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not trigger click when disabled', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(
      <AccessibleButton disabled onClick={handleClick}>
        Disabled
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    await user.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should not trigger click when loading', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(
      <AccessibleButton loading onClick={handleClick}>
        Loading
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    await user.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should support keyboard navigation', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(
      <AccessibleButton onClick={handleClick}>
        Press me
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    button.focus()
    
    // Enter key
    await user.keyboard('{Enter}')
    expect(handleClick).toHaveBeenCalledTimes(1)
    
    // Space key
    await user.keyboard(' ')
    expect(handleClick).toHaveBeenCalledTimes(2)
  })

  it('should announce loading state to screen readers', async () => {
    const { rerender } = render(
      <AccessibleButton>
        Save
      </AccessibleButton>
    )
    
    // Start loading
    rerender(
      <AccessibleButton loading loadingText="Saving...">
        Save
      </AccessibleButton>
    )
    
    await waitFor(() => {
      const announcement = document.querySelector('[role="status"][aria-live="polite"]')
      expect(announcement).toHaveTextContent('Saving...')
    })
    
    // Complete loading
    rerender(
      <AccessibleButton>
        Save
      </AccessibleButton>
    )
    
    await waitFor(() => {
      const announcement = document.querySelector('[role="status"][aria-live="polite"]')
      expect(announcement).toHaveTextContent('Loading complete')
    })
  })

  it('should render with icon', () => {
    const Icon = () => <svg data-testid="icon" />
    
    render(
      <AccessibleButton>
        <Icon />
        With Icon
      </AccessibleButton>
    )
    
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('With Icon')).toBeInTheDocument()
  })

  it('should render as child component when asChild is true', () => {
    render(
      <AccessibleButton asChild>
        <a href="/test">Link Button</a>
      </AccessibleButton>
    )
    
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('should support custom className', () => {
    render(
      <AccessibleButton className="custom-class">
        Custom
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('should forward ref', () => {
    const ref = React.createRef<HTMLButtonElement>()
    
    render(
      <AccessibleButton ref={ref}>
        Button
      </AccessibleButton>
    )
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current?.textContent).toBe('Button')
  })

  it('should handle focus visible styles', async () => {
    const user = userEvent.setup()
    
    render(
      <AccessibleButton>
        Focus me
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    
    // Tab to focus
    await user.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveClass('focus-visible:ring-2')
  })

  it('should maintain button type', () => {
    render(
      <AccessibleButton type="submit">
        Submit
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('should handle aria-pressed for toggle buttons', () => {
    render(
      <AccessibleButton aria-pressed="true">
        Toggle
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('should handle aria-expanded for expandable buttons', () => {
    render(
      <AccessibleButton aria-expanded="false" aria-controls="menu">
        Menu
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'menu')
  })
})