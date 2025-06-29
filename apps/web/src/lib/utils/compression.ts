/**
 * Compression utilities for snapshot storage
 */

import { promisify } from 'util'
import { gzip, gunzip, gzipSync } from 'zlib'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Compress string data using gzip
 */
export async function compress(data: string): Promise<string> {
  try {
    const buffer = Buffer.from(data, 'utf-8')
    const compressed = await gzipAsync(buffer)
    return compressed.toString('base64')
  } catch (error) {
    console.error('Compression error:', error)
    throw new Error(`Failed to compress data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decompress gzip data back to string
 */
export async function decompress(data: string): Promise<string> {
  try {
    const buffer = Buffer.from(data, 'base64')
    const decompressed = await gunzipAsync(buffer)
    return decompressed.toString('utf-8')
  } catch (error) {
    console.error('Decompression error:', error)
    throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(original: string, compressed: string): number {
  const originalSize = Buffer.byteLength(original, 'utf-8')
  const compressedSize = Buffer.byteLength(compressed, 'utf-8')
  return 1 - (compressedSize / originalSize)
}

/**
 * Check if compression is worthwhile
 */
export function shouldCompress(data: string, threshold: number = 0.1): boolean {
  try {
    // Quick test with small sample
    const sample = data.slice(0, 1024)
    const testCompressed = gzipSync(Buffer.from(sample, 'utf-8')).toString('base64')
    const ratio = getCompressionRatio(sample, testCompressed)
    
    return ratio > threshold
  } catch {
    // If compression test fails, don't compress
    return false
  }
}