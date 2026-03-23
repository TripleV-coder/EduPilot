/**
 * Tests pour les utilitaires de performance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  performanceMonitor,
  paginate,
  optimizeAPIResponse,
  limitArraySize,
  shouldCompress,
} from '@/lib/performance-utils';

describe('Performance Utilities', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  describe('Performance Monitor', () => {
    it('should measure sync function performance', async () => {
      const result = await performanceMonitor.measure('test-sync', () => {
        return 'result';
      });

      expect(result).toBe('result');

      const stats = performanceMonitor.getStats('test-sync');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBeGreaterThan(0);
    });

    it('should measure async function performance', async () => {
      const result = await performanceMonitor.measure('test-async', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async-result';
      });

      expect(result).toBe('async-result');

      const stats = performanceMonitor.getStats('test-async');
      expect(stats).toBeDefined();
      expect(stats?.avg).toBeGreaterThanOrEqual(10);
    });

    it('should track multiple operations', async () => {
      await performanceMonitor.measure('op1', () => 'result1');
      await performanceMonitor.measure('op2', () => 'result2');
      await performanceMonitor.measure('op1', () => 'result3');

      const op1Stats = performanceMonitor.getStats('op1');
      const op2Stats = performanceMonitor.getStats('op2');

      expect(op1Stats?.count).toBe(2);
      expect(op2Stats?.count).toBe(1);
    });

    it('should calculate percentiles correctly', async () => {
      // Create operations with varying durations
      for (let i = 0; i < 100; i++) {
        await performanceMonitor.measure('perf-test', async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return i;
        });
      }

      const stats = performanceMonitor.getStats('perf-test');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(100);
      expect(stats?.p50).toBeDefined();
      expect(stats?.p95).toBeDefined();
      expect(stats?.p99).toBeDefined();
      expect(stats?.p99).toBeGreaterThanOrEqual(stats?.p95!);
      expect(stats?.p95).toBeGreaterThanOrEqual(stats?.p50!);
    });
  });

  describe('Pagination', () => {
    it('should paginate array correctly', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const result = paginate(items, 1, 10);

      expect(result.data).toHaveLength(10);
      expect(result.data[0]).toBe(0);
      expect(result.data[9]).toBe(9);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should handle last page', () => {
      const items = Array.from({ length: 95 }, (_, i) => i);
      const result = paginate(items, 10, 10);

      expect(result.data).toHaveLength(5);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should handle empty array', () => {
      const result = paginate([], 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('API Response Optimization', () => {
    it('should return all fields when no fields specified', () => {
      const data = { id: 1, name: 'Test', email: 'test@example.com', password: 'secret' };
      const result = optimizeAPIResponse(data);

      expect(result).toEqual(data);
    });

    it('should filter fields correctly', () => {
      const data = { id: 1, name: 'Test', email: 'test@example.com', password: 'secret' };
      const result = optimizeAPIResponse(data, ['id', 'name']);

      expect(result).toEqual({ id: 1, name: 'Test' });
      expect(result.password).toBeUndefined();
    });

    it('should handle missing fields gracefully', () => {
      const data = { id: 1, name: 'Test' };
      const result = optimizeAPIResponse(data, ['id', 'nonexistent']);

      expect(result).toEqual({ id: 1 });
    });
  });

  describe('Array Utilities', () => {
    it('should limit array size', () => {
      const arr = Array.from({ length: 100 }, (_, i) => i);
      const limited = limitArraySize(arr, 10);

      expect(limited).toHaveLength(10);
      expect(limited[0]).toBe(0);
      expect(limited[9]).toBe(9);
    });

    it('should not modify array smaller than limit', () => {
      const arr = [1, 2, 3];
      const limited = limitArraySize(arr, 10);

      expect(limited).toEqual(arr);
    });
  });

  describe('Compression Helper', () => {
    it('should recommend compression for large JSON', () => {
      expect(shouldCompress('application/json', 2048)).toBe(true);
    });

    it('should not recommend compression for small content', () => {
      expect(shouldCompress('application/json', 512)).toBe(false);
    });

    it('should recommend compression for text', () => {
      expect(shouldCompress('text/html', 2048)).toBe(true);
      expect(shouldCompress('text/plain', 2048)).toBe(true);
    });

    it('should not recommend compression for binary', () => {
      expect(shouldCompress('image/png', 10000)).toBe(false);
      expect(shouldCompress('video/mp4', 10000)).toBe(false);
    });
  });
});
