'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Download, FileJson, FileText, FileSpreadsheet,
  CheckCircle, AlertCircle, Loader2, Info,
  Sparkles, Shield, Brain, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataExporter, type ExportOptions, type ExportData } from '@/lib/export/data-exporter'
import { useToastContext } from '@/contexts/toast-context'

interface ExportDialogProps {
  data: ExportData | ExportData[]
  trigger?: React.ReactNode
  onExport?: (options: ExportOptions) => void
}

interface ExportFormat {
  id: 'json' | 'csv' | 'pdf'
  name: string
  description: string
  icon: React.ElementType
  features: string[]
  limitations?: string[]
  recommended?: boolean
}

const exportFormats: ExportFormat[] = [
  {
    id: 'pdf',
    name: 'PDF Report',
    description: 'Professional report with charts and visualizations',
    icon: FileText,
    features: [
      'Professional formatting',
      'Charts and visualizations',
      'Print-ready layout',
      'Executive summary'
    ],
    recommended: true
  },
  {
    id: 'csv',
    name: 'CSV Spreadsheet',
    description: 'Data in spreadsheet format for analysis',
    icon: FileSpreadsheet,
    features: [
      'Excel compatible',
      'Easy data analysis',
      'Bulk processing',
      'Database import'
    ],
    limitations: [
      'No formatting',
      'Limited to tabular data'
    ]
  },
  {
    id: 'json',
    name: 'JSON Data',
    description: 'Raw data for developers and integrations',
    icon: FileJson,
    features: [
      'Complete data export',
      'API integration ready',
      'Preserves structure',
      'Developer friendly'
    ]
  }
]

const exportSections = [
  {
    id: 'score',
    name: 'Privacy Score',
    description: 'Overall score, grade, and breakdown',
    icon: Shield,
    color: 'text-blue-600'
  },
  {
    id: 'insights',
    name: 'AI Insights',
    description: 'Risks, recommendations, and analysis',
    icon: Brain,
    color: 'text-purple-600'
  },
  {
    id: 'analysis',
    name: 'Detailed Analysis',
    description: 'Complete privacy policy analysis',
    icon: BarChart3,
    color: 'text-green-600'
  },
  {
    id: 'comparison',
    name: 'Industry Comparison',
    description: 'Benchmarks and peer analysis',
    icon: Sparkles,
    color: 'text-amber-600'
  }
]

export function ExportDialog({ data, trigger, onExport }: ExportDialogProps) {
  const { success, error } = useToastContext()
  const [open, setOpen] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv' | 'pdf'>('pdf')
  const [selectedSections, setSelectedSections] = useState({
    includeScore: true,
    includeInsights: true,
    includeAnalysis: false,
    includeComparison: false
  })
  const [isExporting, setIsExporting] = useState(false)

  const dataArray = Array.isArray(data) ? data : [data]
  const isMultiple = dataArray.length > 1

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const options: ExportOptions = {
        format: selectedFormat,
        ...selectedSections
      }

      // Call the exporter
      await DataExporter.export(data, options)

      // Call optional callback
      onExport?.(options)

      success(
        'Export successful',
        `Your ${selectedFormat.toUpperCase()} file has been downloaded.`
      )

      setOpen(false)
    } catch (err) {
      console.error('Export error:', err)
      error(
        'Export failed',
        'There was an error exporting your data. Please try again.'
      )
    } finally {
      setIsExporting(false)
    }
  }

  const toggleSection = (sectionKey: keyof typeof selectedSections) => {
    setSelectedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }

  const selectedSectionCount = Object.values(selectedSections).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Privacy Analysis
          </DialogTitle>
          <DialogDescription>
            {isMultiple 
              ? `Export analysis data for ${dataArray.length} companies`
              : dataArray[0] ? `Export analysis data for ${dataArray[0].company.name}` : 'Export analysis data'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="format" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="format">Format</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <TabsContent value="format" className="space-y-4 mt-4">
            <RadioGroup
              value={selectedFormat}
              onValueChange={(value) => setSelectedFormat(value as typeof selectedFormat)}
            >
              <div className="grid gap-3">
                {exportFormats.map((format) => {
                  const Icon = format.icon
                  return (
                    <motion.div
                      key={format.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Label
                        htmlFor={format.id}
                        className="cursor-pointer"
                      >
                        <Card className={cn(
                          "p-4 transition-all",
                          selectedFormat === format.id 
                            ? "border-primary shadow-lg" 
                            : "hover:border-primary/50"
                        )}>
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={format.id} id={format.id} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-5 w-5 text-primary" />
                                <span className="font-medium">{format.name}</span>
                                {format.recommended && (
                                  <Badge variant="secondary" className="text-xs">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {format.description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {format.features.map((feature, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {feature}
                                  </Badge>
                                ))}
                              </div>
                              {format.limitations && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {format.limitations.map((limitation, i) => (
                                    <Badge key={i} variant="outline" className="text-xs text-orange-600">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      {limitation}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </Label>
                    </motion.div>
                  )
                })}
              </div>
            </RadioGroup>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select which sections to include in your export:
              </p>
              {exportSections.map((section) => {
                const Icon = section.icon
                const sectionKey = `include${section.id.charAt(0).toUpperCase() + section.id.slice(1)}` as keyof typeof selectedSections
                const isSelected = selectedSections[sectionKey]
                
                return (
                  <motion.div
                    key={section.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Label
                      htmlFor={section.id}
                      className="cursor-pointer"
                    >
                      <Card className={cn(
                        "p-4 transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      )}>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={section.id}
                            checked={isSelected}
                            onCheckedChange={() => toggleSection(sectionKey)}
                          />
                          <Icon className={cn("h-5 w-5", section.color)} />
                          <div className="flex-1">
                            <div className="font-medium">{section.name}</div>
                            <p className="text-sm text-muted-foreground">
                              {section.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Label>
                  </motion.div>
                )
              })}
            </div>

            {selectedSectionCount === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                <Info className="h-4 w-4" />
                <p className="text-sm">Please select at least one section to export.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            {selectedSectionCount} section{selectedSectionCount !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || selectedSectionCount === 0}
              className="min-w-[120px]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}