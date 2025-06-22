import { kv } from '@vercel/kv';
import { CacheService, CacheKeys, CacheTags } from './cache';

export interface QueryOptions {
  cache?: boolean;
  cacheTtl?: number;
  batchSize?: number;
  parallel?: boolean;
}

export class DatabaseOptimizer {
  /**
   * Batch get multiple keys from KV store
   */
  static async batchGet<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    
    try {
      // Use pipeline for batch operations
      const pipeline = kv.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      return results as (T | null)[];
    } catch (error) {
      console.error('Batch get error:', error);
      // Fallback to individual gets
      return Promise.all(keys.map(key => kv.get<T>(key)));
    }
  }

  /**
   * Batch set multiple key-value pairs
   */
  static async batchSet(items: { key: string; value: any; ttl?: number }[]): Promise<void> {
    if (items.length === 0) return;
    
    try {
      const pipeline = kv.pipeline();
      
      items.forEach(({ key, value, ttl }) => {
        if (ttl) {
          pipeline.set(key, value, { ex: ttl });
        } else {
          pipeline.set(key, value);
        }
      });
      
      await pipeline.exec();
    } catch (error) {
      console.error('Batch set error:', error);
      // Fallback to individual sets
      await Promise.all(
        items.map(({ key, value, ttl }) =>
          ttl ? kv.set(key, value, { ex: ttl }) : kv.set(key, value)
        )
      );
    }
  }

  /**
   * Optimized query with caching and batching
   */
  static async query<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    options: QueryOptions = {}
  ): Promise<T> {
    const { cache = true, cacheTtl = 3600 } = options;
    
    if (cache) {
      return CacheService.wrap(
        cacheKey,
        queryFn,
        { ttl: cacheTtl }
      );
    }
    
    return queryFn();
  }

  /**
   * Parallel query execution with result aggregation
   */
  static async parallelQueries<T>(
    queries: (() => Promise<T>)[]
  ): Promise<T[]> {
    return Promise.all(queries.map(q => q()));
  }

  /**
   * Paginated query with cursor
   */
  static async paginate<T>(
    key: string,
    cursor: number = 0,
    limit: number = 20
  ): Promise<{
    items: T[];
    nextCursor: number | null;
    hasMore: boolean;
  }> {
    try {
      // For sorted sets
      const items = await kv.zrange<T[]>(key, cursor, cursor + limit - 1);
      const total = await kv.zcard(key);
      
      return {
        items: items || [],
        nextCursor: cursor + limit < total ? cursor + limit : null,
        hasMore: cursor + limit < total
      };
    } catch (error) {
      console.error('Paginate error:', error);
      return { items: [], nextCursor: null, hasMore: false };
    }
  }

  /**
   * Connection pooling simulation for Redis
   */
  static async withConnection<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // KV/Redis handles connection pooling internally
    // This is mainly for monitoring and error handling
    const start = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      console.error('Database operation error:', error);
      throw error;
    }
  }

  /**
   * Index management for faster lookups
   */
  static async createIndex(
    indexName: string,
    items: { id: string; score: number }[]
  ): Promise<void> {
    if (items.length === 0) return;
    
    try {
      const pipeline = kv.pipeline();
      
      // Clear existing index
      pipeline.del(indexName);
      
      // Add items to sorted set index
      items.forEach(({ id, score }) => {
        pipeline.zadd(indexName, { score, member: id });
      });
      
      // Set expiry on index
      pipeline.expire(indexName, 86400); // 24 hours
      
      await pipeline.exec();
    } catch (error) {
      console.error('Create index error:', error);
    }
  }

  /**
   * Query optimizer for complex operations
   */
  static async optimizeQuery(query: {
    table: string;
    filters?: Record<string, any>;
    sort?: { field: string; order: 'asc' | 'desc' };
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { table, filters = {}, sort, limit = 20, offset = 0 } = query;
    
    // Build cache key from query parameters
    const cacheKey = `query:${table}:${JSON.stringify({ filters, sort, limit, offset })}`;
    
    return CacheService.wrap(
      cacheKey,
      async () => {
        // In a real implementation, this would build and execute an optimized query
        // For now, we'll use pattern matching on keys
        const pattern = `${table}:*`;
        const keys = await kv.keys(pattern);
        
        if (!keys || keys.length === 0) return [];
        
        // Batch get all matching records
        const records = await this.batchGet<any>(keys);
        
        // Apply filters
        let filtered = records.filter(Boolean);
        if (Object.keys(filters).length > 0) {
          filtered = filtered.filter(record => {
            return Object.entries(filters).every(([key, value]) => 
              record[key] === value
            );
          });
        }
        
        // Apply sorting
        if (sort) {
          filtered.sort((a, b) => {
            const aVal = a[sort.field];
            const bVal = b[sort.field];
            const modifier = sort.order === 'asc' ? 1 : -1;
            return aVal > bVal ? modifier : -modifier;
          });
        }
        
        // Apply pagination
        return filtered.slice(offset, offset + limit);
      },
      { ttl: 300 } // 5 minute cache
    );
  }

  /**
   * Preload critical data
   */
  static async preloadCriticalData(): Promise<void> {
    const criticalQueries = [
      // Preload active companies
      {
        key: CacheKeys.feedData(1),
        fn: async () => kv.get('companies:active')
      },
      // Preload latest snapshots for top companies
      {
        key: CacheKeys.latestSnapshots('google'),
        fn: async () => kv.zrange(`snapshots:google`, -2, -1)
      },
      {
        key: CacheKeys.latestSnapshots('facebook'),
        fn: async () => kv.zrange(`snapshots:facebook`, -2, -1)
      }
    ];
    
    await CacheService.warm(criticalQueries);
  }
}

// Query builder for complex operations
export class QueryBuilder {
  private query: any = {};
  
  select(fields: string[]): this {
    this.query.select = fields;
    return this;
  }
  
  from(table: string): this {
    this.query.table = table;
    return this;
  }
  
  where(field: string, operator: string, value: any): this {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[field] = { operator, value };
    return this;
  }
  
  orderBy(field: string, order: 'asc' | 'desc' = 'asc'): this {
    this.query.sort = { field, order };
    return this;
  }
  
  limit(limit: number): this {
    this.query.limit = limit;
    return this;
  }
  
  offset(offset: number): this {
    this.query.offset = offset;
    return this;
  }
  
  async execute<T>(): Promise<T[]> {
    return DatabaseOptimizer.optimizeQuery(this.query) as Promise<T[]>;
  }
}