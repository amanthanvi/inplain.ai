'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InteractiveMarkdownProps {
  content: string
  className?: string
}

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-secondary/50 hover:bg-secondary/70 transition-colors flex items-center justify-between text-left"
      >
        <span className="font-medium">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  )
}

function CodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match?.[1] || 'text'
  const code = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-secondary text-sm font-mono" {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export function InteractiveMarkdown({ content, className }: InteractiveMarkdownProps) {
  // Pre-process content to detect collapsible sections
  const processContent = (text: string) => {
    // Convert sections marked with :::collapsible to our custom format
    const collapsibleRegex = /:::collapsible\s*(.+?)\n([\s\S]+?):::/g
    return text.replace(collapsibleRegex, (match, title, content) => {
      return `<CollapsibleSection title="${title}">\n\n${content.trim()}\n\n</CollapsibleSection>`
    })
  }

  const processedContent = processContent(content)

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:scroll-mt-20",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:p-0 prose-pre:m-0",
        className
      )}
      components={{
        // Custom code block rendering
        code: CodeBlock,
        
        // Make links open in new tab with icon
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            {...props}
          >
            {children}
            <ExternalLink className="h-3 w-3" />
          </a>
        ),
        
        // Style tables
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto my-4">
            <table className="border-collapse w-full" {...props}>
              {children}
            </table>
          </div>
        ),
        
        // Add hover effect to table rows
        tr: ({ children, ...props }) => (
          <tr className="hover:bg-secondary/30 transition-colors" {...props}>
            {children}
          </tr>
        ),
        
        // Style blockquotes
        blockquote: ({ children, ...props }) => (
          <blockquote
            className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        ),
        
        // Make headers linkable with anchors
        h1: ({ children, ...props }) => {
          const id = String(children).toLowerCase().replace(/\s+/g, '-')
          return (
            <h1 id={id} className="group relative" {...props}>
              <a href={`#${id}`} className="absolute -left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                #
              </a>
              {children}
            </h1>
          )
        },
        h2: ({ children, ...props }) => {
          const id = String(children).toLowerCase().replace(/\s+/g, '-')
          return (
            <h2 id={id} className="group relative" {...props}>
              <a href={`#${id}`} className="absolute -left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                #
              </a>
              {children}
            </h2>
          )
        },
        h3: ({ children, ...props }) => {
          const id = String(children).toLowerCase().replace(/\s+/g, '-')
          return (
            <h3 id={id} className="group relative" {...props}>
              <a href={`#${id}`} className="absolute -left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                #
              </a>
              {children}
            </h3>
          )
        },
        
        // Interactive task lists
        input: ({ type, checked, ...props }) => {
          if (type === 'checkbox') {
            return (
              <input
                type="checkbox"
                checked={checked}
                className="mr-2 h-4 w-4 rounded border-gray-300"
                readOnly
                {...props}
              />
            )
          }
          return <input type={type} {...props} />
        },

        // Custom component handling
        // @ts-ignore - Custom component
        CollapsibleSection: ({ title, children }: any) => (
          <CollapsibleSection title={title}>
            {children}
          </CollapsibleSection>
        ),
      }}
    >
      {processedContent}
    </ReactMarkdown>
  )
}