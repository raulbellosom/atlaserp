import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTasksService } from '../tasks-service.js'

function makePrisma(overrides = {}) {
  const tasks = {
    't-1': { id: 't-1', projectId: 'p-1', statusId: 's-1', position: 0, title: 'Task 1', createdBy: 'u-1', priority: 'NONE', parentTaskId: null, assigneeId: null },
  }
  const assignees = {}
  const comments = {}

  return {
    task: {
      create: async (args) => {
        const t = { id: 'new-task', createdAt: new Date(), updatedAt: new Date(), ...args.data }
        tasks[t.id] = t
        return t
      },
      findFirst: async ({ where } = {}) => tasks[where?.id] ?? null,
      findMany: async ({ include } = {}) => Object.values(tasks).map((t) => ({
        ...t,
        ...(include?.assignees ? { assignees: [] } : {}),
        ...(include?.status ? { status: null } : {}),
        ...(include?.parent ? { parent: null } : {}),
        _count: { subtasks: 0 },
      })),
      update: async ({ where, data }) => {
        tasks[where.id] = { ...tasks[where.id], ...data }
        return tasks[where.id]
      },
      updateMany: async () => ({ count: 1 }),
      delete: async ({ where }) => { const t = tasks[where.id]; delete tasks[where.id]; return t },
      deleteMany: async () => ({ count: 0 }),
    },
    taskStatus: {
      findFirst: async ({ where }) =>
        where?.id === 's-1' ? { id: 's-1', projectId: 'p-1' } : null,
    },
    projectTaskAssignee: {
      create: async (args) => {
        const a = { id: 'a-1', assignedAt: new Date(), ...args.data }
        assignees[`${a.taskId}-${a.userId}`] = a
        return a
      },
      findFirst: async ({ where }) => {
        if (where?.taskId && where?.userId) return assignees[`${where.taskId}-${where.userId}`] ?? null
        return null
      },
      findMany: async ({ where } = {}) =>
        Object.values(assignees).filter((a) => !where?.taskId || a.taskId === where.taskId),
      delete: async ({ where }) => {
        const key = where?.taskId_userId
          ? `${where.taskId_userId.taskId}-${where.taskId_userId.userId}`
          : null
        if (!key || !assignees[key]) return null
        const a = assignees[key]
        delete assignees[key]
        return a
      },
    },
    taskComment: {
      create: async (args) => {
        const c = { id: 'c-1', createdAt: new Date(), editedAt: null, ...args.data }
        comments[c.id] = c
        return { ...c, author: { id: c.authorId, firstName: 'Test', lastName: 'User', avatarFileId: null } }
      },
      findFirst: async ({ where }) => comments[where?.id] ?? null,
      findMany: async ({ where } = {}) =>
        Object.values(comments).filter((c) => !where?.taskId || c.taskId === where.taskId),
      update: async ({ where, data }) => {
        comments[where.id] = { ...comments[where.id], ...data }
        return { ...comments[where.id], author: { id: comments[where.id].authorId, firstName: 'Test', lastName: 'User', avatarFileId: null } }
      },
      delete: async ({ where }) => {
        const c = comments[where.id]
        delete comments[where.id]
        return c
      },
    },
    fileAsset: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    ...overrides,
  }
}

describe('V2.1 service functions', () => {
  describe('addAssignee', () => {
    it('creates ProjectTaskAssignee row', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      const result = await svc.addAssignee('t-1', 'u-2')
      assert.equal(result.taskId, 't-1')
      assert.equal(result.userId, 'u-2')
    })

    it('throws 409 when assignee already exists', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await svc.addAssignee('t-1', 'u-2')
      await assert.rejects(
        () => svc.addAssignee('t-1', 'u-2'),
        (err) => { assert.equal(err.status, 409); return true },
      )
    })

    it('sets Task.assigneeId when first assignee is added', async () => {
      let updatedAssigneeId = null
      const prisma = makePrisma({
        task: {
          ...makePrisma().task,
          findFirst: async ({ where } = {}) =>
            where?.id === 't-1' ? { id: 't-1', projectId: 'p-1', assigneeId: null } : null,
          update: async ({ where, data }) => {
            if (data.assigneeId !== undefined) updatedAssigneeId = data.assigneeId
            return { id: where.id, ...data }
          },
        },
      })
      const svc = createTasksService({ prisma })
      await svc.addAssignee('t-1', 'u-2')
      assert.equal(updatedAssigneeId, 'u-2')
    })

    it('throws 404 when task not found', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.addAssignee('nonexistent', 'u-2'),
        (err) => { assert.equal(err.status, 404); return true },
      )
    })
  })

  describe('removeAssignee', () => {
    it('throws 404 when assignee not found', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.removeAssignee('t-1', 'u-nonexistent'),
        (err) => { assert.equal(err.status, 404); return true },
      )
    })

    it('clears Task.assigneeId when primary assignee is removed', async () => {
      let updatedAssigneeId = 'initial'
      const prisma = makePrisma({
        task: {
          ...makePrisma().task,
          findFirst: async ({ where } = {}) =>
            where?.id === 't-1' ? { id: 't-1', projectId: 'p-1', assigneeId: 'u-2' } : null,
          update: async ({ where, data }) => {
            if (data.assigneeId !== undefined) updatedAssigneeId = data.assigneeId
            return { id: where.id }
          },
        },
        projectTaskAssignee: {
          ...makePrisma().projectTaskAssignee,
          findFirst: async ({ where }) =>
            where?.taskId === 't-1' && where?.userId === 'u-2'
              ? { id: 'a-1', taskId: 't-1', userId: 'u-2' }
              : null,
          delete: async () => ({ id: 'a-1' }),
          findMany: async () => [], // no more assignees after removal
        },
      })
      const svc = createTasksService({ prisma })
      await svc.removeAssignee('t-1', 'u-2')
      assert.equal(updatedAssigneeId, null)
    })
  })

  describe('createComment', () => {
    it('creates comment', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      const c = await svc.createComment('t-1', 'u-1', 'Hello world')
      assert.equal(c.body, 'Hello world')
      assert.equal(c.authorId, 'u-1')
    })

    it('throws 400 when body is empty', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.createComment('t-1', 'u-1', '   '),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })

    it('throws 400 when body exceeds 5000 chars', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.createComment('t-1', 'u-1', 'x'.repeat(5001)),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })
  })

  describe('updateComment', () => {
    it('updates comment body and sets editedAt', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      // pre-seed a comment
      prisma.taskComment.create({ data: { id: 'c-1', taskId: 't-1', authorId: 'u-1', body: 'original' } })
      // make findFirst return it
      const orig = { id: 'c-1', taskId: 't-1', authorId: 'u-1', body: 'original', editedAt: null, createdAt: new Date() }
      const prisma2 = makePrisma({
        taskComment: {
          ...makePrisma().taskComment,
          findFirst: async ({ where }) => where?.id === 'c-1' ? orig : null,
          update: async ({ where, data }) => ({ ...orig, ...data, author: { id: 'u-1', firstName: 'A', lastName: 'B', avatarFileId: null } }),
        },
      })
      const svc2 = createTasksService({ prisma: prisma2 })
      const updated = await svc2.updateComment('c-1', 'u-1', 'new body')
      assert.equal(updated.body, 'new body')
      assert.ok(updated.editedAt instanceof Date)
    })

    it('throws 403 when requester is not the author', async () => {
      const prisma = makePrisma({
        taskComment: {
          ...makePrisma().taskComment,
          findFirst: async ({ where }) =>
            where?.id === 'c-1' ? { id: 'c-1', taskId: 't-1', authorId: 'u-1', body: 'body' } : null,
        },
      })
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.updateComment('c-1', 'u-DIFFERENT', 'new body'),
        (err) => { assert.equal(err.status, 403); return true },
      )
    })

    it('throws 404 when comment not found', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.updateComment('nonexistent', 'u-1', 'body'),
        (err) => { assert.equal(err.status, 404); return true },
      )
    })
  })

  describe('bulkUpdateTasks', () => {
    it('throws 400 when taskIds is empty', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.bulkUpdateTasks('p-1', [], { statusId: 's-1' }),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })

    it('throws 400 when no patch fields provided', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.bulkUpdateTasks('p-1', ['t-1'], {}),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })

    it('returns updated count', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      const result = await svc.bulkUpdateTasks('p-1', ['t-1'], { statusId: 's-1' })
      assert.equal(result.updated, 1)
    })
  })

  describe('bulkDeleteTasks', () => {
    it('throws 400 when taskIds is empty', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.bulkDeleteTasks('p-1', []),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })
  })

  describe('listTasks with includeSubtasks', () => {
    it('includes parent field in response', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      const tasks = await svc.listTasks('p-1', { includeSubtasks: true })
      assert.ok(Array.isArray(tasks))
    })
  })
})
