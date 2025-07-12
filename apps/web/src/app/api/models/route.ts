import { NextRequest, NextResponse } from 'next/server'
import { ModelCatalog } from '@/lib/ai/model-catalog'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recommended = searchParams.get('recommended') === 'true'
    
    const models = recommended 
      ? ModelCatalog.getRecommendedModels({})
      : ModelCatalog.getAllModels()

    return NextResponse.json({
      models,
      default: process.env.DEFAULT_AI_MODEL || 'anthropic/claude-3.5-sonnet',
      count: models.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Models endpoint error:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputTokens, outputTokens, modelId } = body
    
    if (!inputTokens || !outputTokens || !modelId) {
      return NextResponse.json(
        { error: 'Missing required parameters: inputTokens, outputTokens, modelId' },
        { status: 400 }
      )
    }

    const model = ModelCatalog.getModel(modelId)
    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    const inputCost = (inputTokens / 1000) * model.capabilities.costPer1kTokens.input
    const outputCost = (outputTokens / 1000) * model.capabilities.costPer1kTokens.output
    const totalCost = inputCost + outputCost

    return NextResponse.json({
      model: model.name,
      modelId: model.id,
      inputTokens,
      outputTokens,
      costs: {
        input: inputCost,
        output: outputCost,
        total: totalCost
      },
      costBreakdown: {
        inputCostPer1k: model.capabilities.costPer1kTokens.input,
        outputCostPer1k: model.capabilities.costPer1kTokens.output
      }
    })
  } catch (error) {
    console.error('Cost calculation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to calculate cost' },
      { status: 500 }
    )
  }
}