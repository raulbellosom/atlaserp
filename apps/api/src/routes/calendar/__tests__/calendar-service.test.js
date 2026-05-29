import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCalendarService, CalendarServiceError } from '../calendar-service.js'

function makePrisma(overrides = {}) {
  const defaults = {
    calendarCalendar: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async (args) => ({ id: 'cal-1', isDefault: false, enabled: true, ...args.data }),
      update: async (args) => ({ id: args.where.id, enabled: true, ...args.data }),
    },
    calendarShare: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async (args) => ({ id: 'share-1', ...args.data }),
      update: async (args) => ({ id: args.where.id, ...args.data }),
      delete: async () => {},
    },
  }
  return {
    calendarCalendar: { ...defaults.calendarCalendar, ...(overrides.calendarCalendar ?? {}) },
    calendarShare: { ...defaults.calendarShare, ...(overrides.calendarShare ?? {}) },
  }
}

describe('createCalendarService', () => {
  describe('createCalendar', () => {
    it('creates a calendar with trimmed name', async () => {
      const prisma = makePrisma()
      const svc = createCalendarService({ prisma })
      const result = await svc.createCalendar('user-1', { name: '  Trabajo  ' })
      assert.equal(result.name, 'Trabajo')
      assert.equal(result.ownerId, 'user-1')
    })

    it('throws 400 when name is empty', async () => {
      const svc = createCalendarService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.createCalendar('user-1', { name: '' }),
        (err) => { assert.ok(err instanceof CalendarServiceError); assert.equal(err.status, 400); return true }
      )
    })

    it('throws 400 when name is whitespace only', async () => {
      const svc = createCalendarService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.createCalendar('user-1', { name: '   ' }),
        (err) => { assert.equal(err.status, 400); return true }
      )
    })

    it('applies default color when none provided', async () => {
      const svc = createCalendarService({ prisma: makePrisma() })
      const result = await svc.createCalendar('user-1', { name: 'Test' })
      assert.equal(result.color, '#6B46C1')
    })
  })

  describe('deleteCalendar', () => {
    it('throws 404 when calendar not found', async () => {
      const svc = createCalendarService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.deleteCalendar('user-1', 'missing-id'),
        (err) => { assert.equal(err.status, 404); return true }
      )
    })

    it('throws 400 when trying to delete default calendar', async () => {
      const prisma = makePrisma({
        calendarCalendar: {
          findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', isDefault: true, enabled: true }),
        },
      })
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.deleteCalendar('user-1', 'cal-1'),
        (err) => { assert.equal(err.status, 400); return true }
      )
    })

    it('soft-deletes non-default calendar', async () => {
      let updatedId = null
      const prisma = makePrisma({
        calendarCalendar: {
          findFirst: async () => ({ id: 'cal-2', ownerId: 'user-1', isDefault: false, enabled: true }),
          update: async (args) => { updatedId = args.where.id; return { id: args.where.id } },
        },
      })
      const svc = createCalendarService({ prisma })
      await svc.deleteCalendar('user-1', 'cal-2')
      assert.equal(updatedId, 'cal-2')
    })
  })

  describe('shareCalendar', () => {
    it('throws 404 when calendar not found', async () => {
      const svc = createCalendarService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.shareCalendar('user-1', 'missing', { userId: 'user-2', role: 'VIEWER' }),
        (err) => { assert.equal(err.status, 404); return true }
      )
    })

    it('throws 400 when user tries to share with themselves', async () => {
      const prisma = makePrisma({
        calendarCalendar: { findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', enabled: true }) },
      })
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.shareCalendar('user-1', 'cal-1', { userId: 'user-1', role: 'VIEWER' }),
        (err) => { assert.equal(err.status, 400); return true }
      )
    })

    it('throws 400 for invalid role', async () => {
      const prisma = makePrisma({
        calendarCalendar: { findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', enabled: true }) },
      })
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.shareCalendar('user-1', 'cal-1', { userId: 'user-2', role: 'SUPERADMIN' }),
        (err) => { assert.equal(err.status, 400); return true }
      )
    })

    it('creates share with valid role', async () => {
      let created = null
      const prisma = makePrisma({
        calendarCalendar: { findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', enabled: true }) },
        calendarShare: { create: async (args) => { created = args.data; return { id: 'share-1', ...args.data } } },
      })
      const svc = createCalendarService({ prisma })
      await svc.shareCalendar('user-1', 'cal-1', { userId: 'user-2', role: 'EDITOR' })
      assert.equal(created.role, 'EDITOR')
      assert.equal(created.userId, 'user-2')
    })
  })

  describe('getCalendarRole', () => {
    it('returns OWNER for calendar owner', async () => {
      const prisma = makePrisma({
        calendarCalendar: { findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', enabled: true }) },
      })
      const svc = createCalendarService({ prisma })
      const role = await svc.getCalendarRole('user-1', 'cal-1')
      assert.equal(role, 'OWNER')
    })

    it('returns null when no access', async () => {
      const prisma = makePrisma({
        calendarCalendar: { findFirst: async () => ({ id: 'cal-1', ownerId: 'user-2', enabled: true }) },
        calendarShare: { findFirst: async () => null },
      })
      const svc = createCalendarService({ prisma })
      const role = await svc.getCalendarRole('user-1', 'cal-1')
      assert.equal(role, null)
    })

    it('returns share role for shared calendar', async () => {
      const prisma = makePrisma({
        calendarCalendar: { findFirst: async () => ({ id: 'cal-1', ownerId: 'user-2', enabled: true }) },
        calendarShare: { findFirst: async () => ({ id: 'share-1', role: 'VIEWER' }) },
      })
      const svc = createCalendarService({ prisma })
      const role = await svc.getCalendarRole('user-1', 'cal-1')
      assert.equal(role, 'VIEWER')
    })
  })
})
