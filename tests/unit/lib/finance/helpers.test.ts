import { describe, it, expect } from 'vitest'
import {
  isWithinDateRange,
  getEffectivePaymentDate,
  buildPaymentDateWhere,
  isUnpaidInstallment,
  summarizePaymentPlans,
} from '@/lib/finance/helpers'

describe('Finance Helpers', () => {
  describe('isWithinDateRange', () => {
    it('returns true if no range is provided', () => {
      expect(isWithinDateRange(new Date(), null)).toBe(true)
      expect(isWithinDateRange(new Date(), undefined)).toBe(true)
      expect(isWithinDateRange(new Date(), {})).toBe(true)
    })

    it('respects startDate', () => {
      const range = { startDate: new Date('2023-01-01') }
      expect(isWithinDateRange(new Date('2023-01-02'), range)).toBe(true)
      expect(isWithinDateRange(new Date('2022-12-31'), range)).toBe(false)
    })

    it('respects endDate', () => {
      const range = { endDate: new Date('2023-12-31') }
      expect(isWithinDateRange(new Date('2023-05-05'), range)).toBe(true)
      expect(isWithinDateRange(new Date('2024-01-01'), range)).toBe(false)
    })

    it('respects both startDate and endDate', () => {
      const range = { startDate: new Date('2023-01-01'), endDate: new Date('2023-12-31') }
      expect(isWithinDateRange(new Date('2023-06-15'), range)).toBe(true)
      expect(isWithinDateRange(new Date('2022-12-31'), range)).toBe(false)
      expect(isWithinDateRange(new Date('2024-01-01'), range)).toBe(false)
    })
  })

  describe('getEffectivePaymentDate', () => {
    it('returns paidAt if available', () => {
      const paidAt = new Date('2023-05-01')
      const createdAt = new Date('2023-04-01')
      expect(getEffectivePaymentDate({ paidAt, createdAt, amount: 100 })).toBe(paidAt)
    })

    it('falls back to createdAt if paidAt is null', () => {
      const createdAt = new Date('2023-04-01')
      expect(getEffectivePaymentDate({ paidAt: null, createdAt, amount: 100 })).toBe(createdAt)
    })
  })

  describe('buildPaymentDateWhere', () => {
    it('returns empty object if no range is provided', () => {
      expect(buildPaymentDateWhere(null)).toEqual({})
      expect(buildPaymentDateWhere({})).toEqual({})
    })

    it('builds correct Prisma where clause with full range', () => {
      const range = { startDate: new Date('2023-01-01'), endDate: new Date('2023-12-31') }
      const where = buildPaymentDateWhere(range)
      expect(where).toEqual({
        OR: [
          { paidAt: { gte: range.startDate, lte: range.endDate } },
          { paidAt: null, createdAt: { gte: range.startDate, lte: range.endDate } }
        ]
      })
    })
    
    it('builds correct Prisma where clause with only startDate', () => {
      const range = { startDate: new Date('2023-01-01') }
      const where = buildPaymentDateWhere(range)
      expect(where).toEqual({
        OR: [
          { paidAt: { gte: range.startDate } },
          { paidAt: null, createdAt: { gte: range.startDate } }
        ]
      })
    })
  })

  describe('isUnpaidInstallment', () => {
    it('returns false for PAID and CANCELLED', () => {
      expect(isUnpaidInstallment('PAID')).toBe(false)
      expect(isUnpaidInstallment('CANCELLED')).toBe(false)
    })

    it('returns true for PENDING and OVERDUE', () => {
      expect(isUnpaidInstallment('PENDING')).toBe(true)
      expect(isUnpaidInstallment('OVERDUE')).toBe(true)
    })
  })

  describe('summarizePaymentPlans', () => {
    const mockPlans = [
      {
        totalAmount: 1000,
        paidAmount: 200,
        fee: { dueDate: new Date('2023-12-31') },
        installmentPayments: [
          { id: '1', amount: 300, dueDate: new Date('2023-03-01'), status: 'PAID' },
          { id: '2', amount: 300, dueDate: new Date('2023-06-01'), status: 'PENDING' },
          { id: '3', amount: 400, dueDate: new Date('2023-09-01'), status: 'PENDING' },
        ]
      },
      {
        totalAmount: 500,
        paidAmount: 500,
        fee: { dueDate: new Date('2023-12-31') },
        installmentPayments: [] // No installments, full fee due
      }
    ]

    it('summarizes total across all time if no range provided', () => {
      const summary = summarizePaymentPlans(mockPlans, null)
      expect(summary.totalExpected).toBe(1500)
      expect(summary.totalPending).toBe(800) // (1000 - 200) + (500 - 500)
    })

    it('summarizes only relevant installments within range', () => {
      // Range covers only the second installment (June)
      const range = { startDate: new Date('2023-05-01'), endDate: new Date('2023-07-01') }
      const summary = summarizePaymentPlans(mockPlans, range)
      
      expect(summary.totalExpected).toBe(300) // Only the June installment is expected
      expect(summary.totalPending).toBe(300) // The June installment is PENDING
    })
    
    it('handles fee due date within range when no installments exist', () => {
      // Range covers the fee due date (December)
      const range = { startDate: new Date('2023-11-01'), endDate: new Date('2024-01-01') }
      const summary = summarizePaymentPlans(mockPlans, range)
      
      // First plan has installments but none in this range
      // Second plan has no installments, but fee due date is in range
      expect(summary.totalExpected).toBe(500) // Only the second plan is expected
      expect(summary.totalPending).toBe(0) // Second plan is fully paid
    })
  })
})
