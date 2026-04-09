import { describe, it, expect } from 'vitest'
import {
  dedupeLatestAnalyticsByStudent,
  averageNumbers,
  roundTo,
  normalizeGradeTo20
} from '@/lib/analytics/helpers'

describe('Analytics Helpers', () => {
  describe('roundTo', () => {
    it('rounds to specified decimal places', () => {
      expect(roundTo(10.555, 2)).toBe(10.56)
      expect(roundTo(10.554, 2)).toBe(10.55)
      expect(roundTo(10.5, 0)).toBe(11)
      expect(roundTo(10.4, 0)).toBe(10)
    })
    
    it('defaults to 2 decimal places', () => {
      expect(roundTo(10.1234)).toBe(10.12)
    })
  })

  describe('normalizeGradeTo20', () => {
    it('normalizes grades to a base of 20', () => {
      expect(normalizeGradeTo20(10, 10)).toBe(20)
      expect(normalizeGradeTo20(5, 10)).toBe(10)
      expect(normalizeGradeTo20(75, 100)).toBe(15)
      expect(normalizeGradeTo20(18, 20)).toBe(18)
    })

    it('returns null for invalid inputs', () => {
      expect(normalizeGradeTo20(null, 20)).toBeNull()
      expect(normalizeGradeTo20(10, null)).toBeNull()
      expect(normalizeGradeTo20(10, 0)).toBeNull()
      expect(normalizeGradeTo20(undefined, 20)).toBeNull()
    })
  })

  describe('averageNumbers', () => {
    it('calculates the average of an array of numbers', () => {
      expect(averageNumbers([10, 20, 30])).toBe(20)
      expect(averageNumbers([10, 15])).toBe(12.5)
    })

    it('ignores null and undefined values', () => {
      expect(averageNumbers([10, null, 20, undefined, 30])).toBe(20)
    })

    it('returns null for an empty array or array with only invalid values', () => {
      expect(averageNumbers([])).toBeNull()
      expect(averageNumbers([null, undefined])).toBeNull()
    })
  })

  describe('dedupeLatestAnalyticsByStudent', () => {
    const mockData = [
      {
        studentId: '1',
        period: { sequence: 1 },
        analyzedAt: new Date('2023-01-01'),
        createdAt: new Date('2023-01-01')
      },
      {
        studentId: '1',
        period: { sequence: 2 }, // Latest by sequence
        analyzedAt: new Date('2023-01-01'),
        createdAt: new Date('2023-01-01')
      },
      {
        studentId: '2',
        period: null,
        analyzedAt: new Date('2023-01-01'),
        createdAt: new Date('2023-01-01')
      },
      {
        studentId: '2',
        period: null,
        analyzedAt: new Date('2023-02-01'), // Latest by analyzedAt
        createdAt: new Date('2023-01-01')
      },
      {
        studentId: '3',
        period: null,
        analyzedAt: null,
        createdAt: new Date('2023-01-01')
      },
      {
        studentId: '3',
        period: null,
        analyzedAt: null,
        createdAt: new Date('2023-02-01') // Latest by createdAt
      }
    ]

    it('deduplicates and keeps the latest entry based on period sequence', () => {
      const result = dedupeLatestAnalyticsByStudent(mockData)
      const student1 = result.find(r => r.studentId === '1')
      expect(student1?.period?.sequence).toBe(2)
    })

    it('falls back to analyzedAt if sequence is missing or equal', () => {
      const result = dedupeLatestAnalyticsByStudent(mockData)
      const student2 = result.find(r => r.studentId === '2')
      expect(student2?.analyzedAt?.getTime()).toBe(new Date('2023-02-01').getTime())
    })

    it('falls back to createdAt if analyzedAt is missing', () => {
      const result = dedupeLatestAnalyticsByStudent(mockData)
      const student3 = result.find(r => r.studentId === '3')
      expect(student3?.createdAt?.getTime()).toBe(new Date('2023-02-01').getTime())
    })
    
    it('returns an array with exactly one entry per student', () => {
      const result = dedupeLatestAnalyticsByStudent(mockData)
      expect(result.length).toBe(3)
      const ids = result.map(r => r.studentId)
      expect(new Set(ids).size).toBe(3)
    })
  })
})

