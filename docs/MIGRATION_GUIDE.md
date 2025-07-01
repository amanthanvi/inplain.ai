# Migration Guide

## Unified Storage System Migration

This guide helps you migrate from the old storage implementations to the new unified storage system.

### Overview

The unified storage system consolidates three different storage implementations into a single, consistent interface with automatic chunking, compression, and error handling.

### Migration Steps

#### 1. Update Imports

Replace old storage imports:

```typescript
// Old
import { storeSnapshot } from '@/lib/storage/snapshot-storage'
import { cacheAnalysis } from '@/lib/cache/analysis-cache'
import { kvStorage } from '@/lib/kv/storage'

// New
import { unifiedStorage } from '@/lib/storage/unified-storage'
```

#### 2. Update Storage Calls

Replace storage method calls:

```typescript
// Old - Snapshot storage
await storeSnapshot(companyId, snapshot)
const snapshot = await getSnapshot(companyId, version)

// New
await unifiedStorage.set(`snapshot:${companyId}:${version}`, snapshot)
const snapshot = await unifiedStorage.get(`snapshot:${companyId}:${version}`)

// Old - Analysis cache
await cacheAnalysis(analysisKey, result)
const cached = await getCachedAnalysis(analysisKey)

// New
await unifiedStorage.set(`analysis:${analysisKey}`, result, { 
  ttl: 3600 // 1 hour cache
})
const cached = await unifiedStorage.get(`analysis:${analysisKey}`)

// Old - KV storage
await kvStorage.put(key, value)
const value = await kvStorage.get(key)

// New
await unifiedStorage.set(key, value)
const value = await unifiedStorage.get(key)
```

#### 3. Handle Large Content

The unified storage automatically handles content chunking:

```typescript
// Old - Manual chunking required
const chunks = splitIntoChunks(largeContent)
for (let i = 0; i < chunks.length; i++) {
  await kv.set(`${key}:chunk:${i}`, chunks[i])
}

// New - Automatic chunking
await unifiedStorage.set(key, largeContent) // Handles chunking internally
```

#### 4. Update Error Handling

The unified storage provides consistent error handling:

```typescript
// Old
try {
  await storeSnapshot(companyId, snapshot)
} catch (error) {
  if (error.message.includes('too large')) {
    // Handle size error
  }
}

// New
const result = await unifiedStorage.set(`snapshot:${companyId}:${version}`, snapshot)
if (!result.success) {
  console.error('Storage failed:', result.error)
  // Handle error appropriately
}
```

### Key Namespacing Convention

Use consistent key prefixes:

- Snapshots: `snapshot:{companyId}:{version}`
- Analysis: `analysis:{type}:{companyId}:{hash}`
- Cache: `cache:{type}:{key}`
- User data: `user:{userId}:{dataType}`

### Benefits of Migration

1. **Automatic Chunking**: Handles large content (>512KB) automatically
2. **Compression**: Optional compression reduces storage usage
3. **Consistent Interface**: Same API for all storage operations
4. **Better Error Handling**: Detailed error messages and recovery
5. **Performance**: Optimized for Vercel KV with proper TTL management

### Rollback Plan

If you need to rollback:

1. Keep old storage code in place during migration
2. Use feature flags to switch between implementations
3. Test thoroughly in staging before production deployment

### Common Issues and Solutions

#### Issue: Key Not Found
```typescript
// Ensure you're using the correct key format
const key = `snapshot:${companyId}:${version}` // Correct
const key = `${companyId}/${version}` // Incorrect (old format)
```

#### Issue: Content Too Large
```typescript
// Enable compression for large content
await unifiedStorage.set(key, largeContent, { 
  compress: true // Automatically compresses
})
```

#### Issue: TTL Not Working
```typescript
// Specify TTL in seconds
await unifiedStorage.set(key, value, { 
  ttl: 3600 // 1 hour in seconds
})
```

### Support

For migration assistance:
- Check logs for detailed error messages
- Review the unified storage implementation in `/lib/storage/unified-storage.ts`
- Test in development environment first