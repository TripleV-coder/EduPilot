/**
 * Tests de performance pour le système de cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  clearCache,
  CACHE_TTLS,
  CACHE_PREFIXES,
} from '@/lib/redis-cache';

describe('Redis Cache System', () => {
  beforeEach(async () => {
    await clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  describe('Basic Operations', () => {
    it('should set and get cache value', async () => {
      const key = 'test-key';
      const value = { name: 'Test', age: 25 };

      await setCache(key, value, { ttl: CACHE_TTLS.SHORT });
      const retrieved = await getCache(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await getCache('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should delete cache value', async () => {
      const key = 'delete-test';
      await setCache(key, 'value');
      
      let retrieved = await getCache(key);
      expect(retrieved).toBe('value');

      await deleteCache(key);
      retrieved = await getCache(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Cache Prefix', () => {
    it('should work with prefixed keys', async () => {
      const key = 'user-123';
      const value = { name: 'John Doe' };

      await setCache(key, value, { prefix: CACHE_PREFIXES.USER });
      const retrieved = await getCache(key, { prefix: CACHE_PREFIXES.USER });

      expect(retrieved).toEqual(value);
    });

    it('should isolate different prefixes', async () => {
      const key = 'same-key';
      
      await setCache(key, 'user-data', { prefix: CACHE_PREFIXES.USER });
      await setCache(key, 'school-data', { prefix: CACHE_PREFIXES.SCHOOL });

      const userData = await getCache(key, { prefix: CACHE_PREFIXES.USER });
      const schoolData = await getCache(key, { prefix: CACHE_PREFIXES.SCHOOL });

      expect(userData).toBe('user-data');
      expect(schoolData).toBe('school-data');
    });
  });

  describe('Pattern Deletion', () => {
    it('should delete keys matching pattern', async () => {
      await setCache('user:1', 'data1');
      await setCache('user:2', 'data2');
      await setCache('school:1', 'data3');

      await deleteCachePattern('user:*');

      const user1 = await getCache('user:1');
      const user2 = await getCache('user:2');
      const school1 = await getCache('school:1');

      expect(user1).toBeNull();
      expect(user2).toBeNull();
      expect(school1).toBe('data3');
    });
  });

  describe('TTL Expiration', () => {
    it('should expire after TTL', async () => {
      const key = 'expiring-key';
      const value = 'temporary';

      // Set with 1 second TTL
      await setCache(key, value, { ttl: 1 });

      // Should exist immediately
      let retrieved = await getCache(key);
      expect(retrieved).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should be expired
      retrieved = await getCache(key);
      expect(retrieved).toBeNull();
    }, 10000);
  });

  describe('Complex Data Types', () => {
    it('should handle arrays', async () => {
      const key = 'array-test';
      const value = [1, 2, 3, 4, 5];

      await setCache(key, value);
      const retrieved = await getCache<number[]>(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle nested objects', async () => {
      const key = 'nested-test';
      const value = {
        user: {
          name: 'John',
          address: {
            city: 'Paris',
            country: 'France',
          },
        },
      };

      await setCache(key, value);
      const retrieved = await getCache(key);

      expect(retrieved).toEqual(value);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        setCache(`key-${i}`, `value-${i}`)
      );

      await Promise.all(operations);

      const retrievals = Array.from({ length: 100 }, (_, i) =>
        getCache(`key-${i}`)
      );

      const results = await Promise.all(retrievals);
      expect(results.every((r, i) => r === `value-${i}`)).toBe(true);
    });

    it('should complete cache operations quickly', async () => {
      const start = Date.now();
      
      await setCache('perf-test', { data: 'test' });
      await getCache('perf-test');
      await deleteCache('perf-test');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });
  });
});
