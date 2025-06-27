import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PrivacyScoreResult } from '@/lib/privacy/advanced-scoring'
import type { EnhancedInsight } from '@/lib/ai/enhanced-ai-service'
import type { Company } from '@inplain.ai/shared'

export interface ExportData {
  company: Company
  score?: PrivacyScoreResult
  insights?: EnhancedInsight[]
  analysis?: any
  comparison?: any
  timestamp: string
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf'
  includeScore?: boolean
  includeInsights?: boolean
  includeAnalysis?: boolean
  includeComparison?: boolean
  filename?: string
}

export class DataExporter {
  /**
   * Export data in the specified format
   */
  static async export(data: ExportData | ExportData[], options: ExportOptions): Promise<void> {
    const dataArray = Array.isArray(data) ? data : [data]
    if (dataArray.length === 0) {
      throw new Error('No data to export')
    }
    const filename = options.filename || this.generateFilename(dataArray[0]!.company.name, options.format)

    switch (options.format) {
      case 'json':
        await this.exportJSON(dataArray, filename, options)
        break
      case 'csv':
        await this.exportCSV(dataArray, filename, options)
        break
      case 'pdf':
        await this.exportPDF(dataArray, filename, options)
        break
      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  /**
   * Export data as JSON
   */
  private static async exportJSON(
    data: ExportData[], 
    filename: string, 
    options: ExportOptions
  ): Promise<void> {
    const exportData = data.map(item => this.prepareDataForExport(item, options))
    const jsonContent = JSON.stringify(exportData, null, 2)
    
    this.downloadFile(jsonContent, `${filename}.json`, 'application/json')
  }

  /**
   * Export data as CSV
   */
  private static async exportCSV(
    data: ExportData[], 
    filename: string, 
    options: ExportOptions
  ): Promise<void> {
    const headers: string[] = ['Company', 'Category', 'Website']
    const rows: any[][] = []

    if (options.includeScore) {
      headers.push('Overall Score', 'Grade', 'Risk Level', 'Industry Rank')
    }

    if (options.includeInsights) {
      headers.push('Critical Insights', 'Recommendations')
    }

    // Prepare rows
    data.forEach(item => {
      const row: any[] = [
        item.company.name,
        item.company.category || 'N/A',
        item.company.url
      ]

      if (options.includeScore && item.score) {
        row.push(
          item.score.overallScore,
          item.score.grade,
          this.getRiskLevel(item.score.overallScore),
          (item.score.comparison as any)?.rank || 'N/A'
        )
      }

      if (options.includeInsights && item.insights) {
        const criticalInsights = item.insights
          .filter(i => i.severity === 'critical' || i.severity === 'high')
          .slice(0, 3)
          .map(i => i.title)
          .join('; ')
        
        const recommendations = item.insights
          .filter(i => i.type === 'recommendation')
          .slice(0, 3)
          .map(i => i.title)
          .join('; ')

        row.push(criticalInsights || 'None', recommendations || 'None')
      }

      rows.push(row)
    })

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(','))
    ].join('\n')

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv')
  }

  /**
   * Export data as PDF
   */
  private static async exportPDF(
    data: ExportData[], 
    filename: string, 
    options: ExportOptions
  ): Promise<void> {
    const pdf = new jsPDF()
    let yPosition = 20

    // Add title
    pdf.setFontSize(20)
    pdf.text('Privacy Policy Analysis Report', 20, yPosition)
    yPosition += 15

    // Add metadata
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, yPosition)
    pdf.text(`Report by: InPlain Privacy`, 120, yPosition)
    yPosition += 15

    // Process each company
    data.forEach((item, index) => {
      if (index > 0) {
        pdf.addPage()
        yPosition = 20
      }

      // Company header
      pdf.setFontSize(16)
      pdf.setTextColor(0, 0, 0)
      pdf.text(item.company.name, 20, yPosition)
      yPosition += 10

      pdf.setFontSize(10)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Category: ${item.company.category || 'N/A'}`, 20, yPosition)
      pdf.text(`Website: ${item.company.url}`, 80, yPosition)
      yPosition += 15

      // Privacy Score Section
      if (options.includeScore && item.score) {
        pdf.setFontSize(14)
        pdf.setTextColor(0, 0, 0)
        pdf.text('Privacy Score', 20, yPosition)
        yPosition += 10

        // Score details
        const scoreData = [
          ['Overall Score', `${item.score.overallScore}/100`],
          ['Grade', item.score.grade],
          ['Risk Level', this.getRiskLevel(item.score.overallScore)],
          ['Industry Rank', `#${(item.score.comparison as any)?.rank || 'N/A'}`]
        ]

        autoTable(pdf, {
          startY: yPosition,
          head: [['Metric', 'Value']],
          body: scoreData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 20, right: 20 }
        })

        yPosition = (pdf as any).lastAutoTable.finalY + 15

        // Breakdown
        if (item.score.breakdown) {
          pdf.setFontSize(12)
          pdf.text('Score Breakdown', 20, yPosition)
          yPosition += 10

          const breakdownData = Object.entries(item.score.breakdown).map(([key, value]) => [
            this.formatDimensionName(key),
            `${value}/100`
          ])

          autoTable(pdf, {
            startY: yPosition,
            head: [['Dimension', 'Score']],
            body: breakdownData,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
            margin: { left: 20, right: 20 }
          })

          yPosition = (pdf as any).lastAutoTable.finalY + 15
        }
      }

      // Insights Section
      if (options.includeInsights && item.insights && item.insights.length > 0) {
        pdf.setFontSize(14)
        pdf.setTextColor(0, 0, 0)
        pdf.text('Key Insights', 20, yPosition)
        yPosition += 10

        // Critical insights
        const criticalInsights = item.insights.filter(
          i => i.severity === 'critical' || i.severity === 'high'
        )

        if (criticalInsights.length > 0) {
          pdf.setFontSize(12)
          pdf.setTextColor(220, 38, 38) // Red
          pdf.text('Critical Findings', 20, yPosition)
          yPosition += 8

          criticalInsights.slice(0, 5).forEach(insight => {
            pdf.setFontSize(10)
            pdf.setTextColor(0, 0, 0)
            
            const lines = pdf.splitTextToSize(`• ${insight.title}: ${insight.summary}`, 170)
            lines.forEach((line: string) => {
              if (yPosition > 270) {
                pdf.addPage()
                yPosition = 20
              }
              pdf.text(line, 25, yPosition)
              yPosition += 5
            })
            yPosition += 3
          })
        }

        // Recommendations
        const recommendations = item.insights.filter(i => i.type === 'recommendation')
        
        if (recommendations.length > 0) {
          yPosition += 5
          pdf.setFontSize(12)
          pdf.setTextColor(34, 197, 94) // Green
          pdf.text('Recommendations', 20, yPosition)
          yPosition += 8

          recommendations.slice(0, 5).forEach(rec => {
            pdf.setFontSize(10)
            pdf.setTextColor(0, 0, 0)
            
            const lines = pdf.splitTextToSize(`• ${rec.title}`, 170)
            lines.forEach((line: string) => {
              if (yPosition > 270) {
                pdf.addPage()
                yPosition = 20
              }
              pdf.text(line, 25, yPosition)
              yPosition += 5
            })
            yPosition += 3
          })
        }
      }

      // Privacy Flags
      if (item.score?.flags) {
        yPosition += 5
        pdf.setFontSize(12)
        pdf.text('Privacy Concerns', 20, yPosition)
        yPosition += 8

        const flagData = Object.entries(item.score.flags)
          .filter(([_, active]) => active)
          .map(([flag, _]) => [this.formatFlagName(flag), '⚠️ Detected'])

        if (flagData.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [['Concern', 'Status']],
            body: flagData,
            theme: 'striped',
            headStyles: { fillColor: [245, 158, 11] }, // Yellow
            margin: { left: 20, right: 20 }
          })
        }
      }
    })

    // Save PDF
    pdf.save(`${filename}.pdf`)
  }

  /**
   * Prepare data for export based on options
   */
  private static prepareDataForExport(data: ExportData, options: ExportOptions): any {
    const result: any = {
      company: {
        name: data.company.name,
        category: data.company.category,
        url: data.company.url
      },
      exportedAt: new Date().toISOString()
    }

    if (options.includeScore && data.score) {
      result.privacyScore = {
        overall: data.score.overallScore,
        grade: data.score.grade,
        breakdown: data.score.breakdown,
        strengths: data.score.strengths,
        improvements: data.score.improvements,
        certifications: data.score.certifications,
        flags: data.score.flags
      }
    }

    if (options.includeInsights && data.insights) {
      result.insights = data.insights.map(insight => ({
        type: insight.type,
        severity: insight.severity,
        title: insight.title,
        summary: insight.summary,
        confidence: insight.confidence,
        details: insight.details
      }))
    }

    if (options.includeAnalysis && data.analysis) {
      result.analysis = data.analysis
    }

    if (options.includeComparison && data.comparison) {
      result.comparison = data.comparison
    }

    return result
  }

  /**
   * Download file to user's device
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Generate filename with timestamp
   */
  private static generateFilename(companyName: string, format: string): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const sanitizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    return `privacy-report-${sanitizedName}-${timestamp}`
  }

  /**
   * Escape CSV values
   */
  private static escapeCSV(value: any): string {
    if (value === null || value === undefined) return ''
    
    const stringValue = String(value)
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    
    return stringValue
  }

  /**
   * Get risk level from score
   */
  private static getRiskLevel(score: number): string {
    if (score >= 80) return 'Low'
    if (score >= 60) return 'Medium'
    if (score >= 40) return 'High'
    return 'Critical'
  }

  /**
   * Format dimension name for display
   */
  private static formatDimensionName(key: string): string {
    const mappings: Record<string, string> = {
      dataMinimization: 'Data Minimization',
      purposeLimitation: 'Purpose Limitation',
      transparency: 'Transparency',
      userControl: 'User Control',
      security: 'Security',
      accountability: 'Accountability',
      lawfulness: 'Lawfulness'
    }
    return mappings[key] || key
  }

  /**
   * Format flag name for display
   */
  private static formatFlagName(flag: string): string {
    return flag
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, str => str.toUpperCase())
  }
}