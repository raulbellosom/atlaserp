import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryNotificationService } from '../inventory-notification-service.js'

const COMPANY_ID  = '01900000-0000-7000-8000-000000000001'
const ACTOR_ID    = '01900000-0000-7000-8000-000000000002'
const ITEM_ID     = '01900000-0000-7000-8000-000000000003'
const COMMENT_ID  = '01900000-0000-7000-8000-000000000005'
const MENTION_ID  = '01900000-0000-7000-8000-000000000006'
const AUTHOR_ID   = '01900000-0000-7000-8000-000000000007'

function buildPrisma(overrides = {}) {
  return {
    invItem: {
      findFirst: async () => ({ id: ITEM_ID, name: 'Laptop Test' }),
      ...(overrides.invItem ?? {}),
    },
    invComment: {
      findFirst: async () => ({ id: COMMENT_ID, authorId: AUTHOR_ID, item: { id: ITEM_ID, name: 'Laptop Test' } }),
      ...(overrides.invComment ?? {}),
    },
    ...(overrides._root ?? {}),
  }
}

describe('notifyInvComment', () => {
  it('calls publish with mention eventType for mentioned users', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [MENTION_ID] })

    assert.equal(published.length, 1, 'publish called once for mention')
    assert.equal(published[0].input.eventType, 'inventory.item.mention')
    assert.deepEqual(published[0].input.recipients.userIds, [MENTION_ID])
    assert.equal(published[0].input.priority, 'medium')
    assert.ok(published[0].input.link.includes(ITEM_ID))
  })

  it('skips publish when mentionedUserIds is empty', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [] })

    assert.equal(published.length, 0, 'publish not called when no mentions')
  })

  it('excludes the actor from mention recipients', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [ACTOR_ID] })

    assert.equal(published.length, 0, 'self-mention skipped')
  })

  it('does not throw when item is not found', async () => {
    const notifSvc = { publish: async () => { throw new Error('should not reach') } }
    const prisma = buildPrisma({ invItem: { findFirst: async () => null } })
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await assert.doesNotReject(() =>
      svc.notifyInvComment({ companyId: COMPANY_ID, actorId: ACTOR_ID, itemId: ITEM_ID, mentionedUserIds: [MENTION_ID] })
    )
  })
})

describe('notifyInvReaction', () => {
  it('calls publish with reaction eventType to comment author', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma()
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvReaction({ companyId: COMPANY_ID, actorId: ACTOR_ID, commentId: COMMENT_ID })

    assert.equal(published.length, 1, 'publish called once')
    assert.equal(published[0].input.eventType, 'inventory.item.reaction')
    assert.deepEqual(published[0].input.recipients.userIds, [AUTHOR_ID])
    assert.equal(published[0].input.priority, 'low')
  })

  it('skips publish when actor is the comment author', async () => {
    const published = []
    const notifSvc = { publish: async (args) => { published.push(args); return {} } }
    const prisma = buildPrisma({
      invComment: { findFirst: async () => ({ id: COMMENT_ID, authorId: ACTOR_ID, item: { id: ITEM_ID, name: 'Laptop Test' } }) },
    })
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await svc.notifyInvReaction({ companyId: COMPANY_ID, actorId: ACTOR_ID, commentId: COMMENT_ID })

    assert.equal(published.length, 0, 'self-reaction not notified')
  })

  it('does not throw when comment is not found', async () => {
    const notifSvc = { publish: async () => { throw new Error('should not reach') } }
    const prisma = buildPrisma({ invComment: { findFirst: async () => null } })
    const svc = createInventoryNotificationService({ prisma, notificationService: notifSvc })

    await assert.doesNotReject(() =>
      svc.notifyInvReaction({ companyId: COMPANY_ID, actorId: ACTOR_ID, commentId: COMMENT_ID })
    )
  })
})
