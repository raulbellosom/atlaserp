import { Hono } from 'hono'
import { createNotesService } from './notes-service.js'
import { createFoldersService } from './folders-service.js'
import { createTagsService } from './tags-service.js'
import { createSharesService } from './shares-service.js'
import { createYDocService } from './ydoc-service.js'

export function createNotesRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission, broadcaster }) {
  const app = new Hono()
  const notes = createNotesService({ prisma, broadcaster })
  const folders = createFoldersService({ prisma })
  const tags = createTagsService({ prisma })
  const shares = createSharesService({ prisma, broadcaster })
  const ydoc = createYDocService({ prisma })

  // ----------------------------------------------------------------
  // Public routes (no auth) — must be registered before the auth middleware
  // ----------------------------------------------------------------

  app.get('/public/notes/:slug', async (c) => {
    try {
      const slug = c.req.param('slug')
      const data = await shares.getPublicNote(slug)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ----------------------------------------------------------------
  // All /notes/* routes require authentication
  // ----------------------------------------------------------------
  app.use('/notes/*', authMiddleware)

  // ----------------------------------------------------------------
  // Helper — extract userId and companyId from Hono context
  // ----------------------------------------------------------------
  function getAuth(c) {
    const authUserId = c.get('authUserId')
    const companyId = c.get('userContext')?.memberships?.[0]?.companyId ?? null
    return { userId: authUserId, companyId }
  }

  // ================================================================
  // FOLDERS — register BEFORE /notes/:id to avoid "folders" matching :id
  // ================================================================

  // GET /notes/folders
  app.get('/notes/folders', requirePermission('notes.folders.read'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const data = await folders.listFolders({ userId, companyId })
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/folders
  app.post('/notes/folders', requirePermission('notes.folders.create'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const body = await c.req.json()
      const { name, color, icon, parentFolderId, sortOrder } = body
      const data = await folders.createFolder({ userId, companyId, name, color, icon, parentFolderId, sortOrder })
      return c.json({ data }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/folders/:id
  app.patch('/notes/folders/:id', requirePermission('notes.folders.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const folderId = c.req.param('id')
      const body = await c.req.json()
      const data = await folders.updateFolder(folderId, userId, body)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/folders/:id
  app.delete('/notes/folders/:id', requirePermission('notes.folders.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const folderId = c.req.param('id')
      const data = await folders.deleteFolder(folderId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // TAGS — register BEFORE /notes/:id to avoid "tags" matching :id
  // ================================================================

  // GET /notes/tags
  app.get('/notes/tags', requirePermission('notes.tags.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const data = await tags.listTags({ userId })
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/tags
  app.post('/notes/tags', requirePermission('notes.tags.create'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const body = await c.req.json()
      const { name, color } = body
      const data = await tags.createTag({ userId, companyId, name, color })
      return c.json({ data }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/tags/:id
  app.patch('/notes/tags/:id', requirePermission('notes.tags.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const tagId = c.req.param('id')
      const body = await c.req.json()
      const data = await tags.updateTag(tagId, userId, body)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/tags/:id
  app.delete('/notes/tags/:id', requirePermission('notes.tags.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const tagId = c.req.param('id')
      const data = await tags.deleteTag(tagId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // PRESIGN IMAGE — register before /notes/:id
  // ================================================================

  // POST /notes/presign-image
  app.post('/notes/presign-image', requirePermission('notes.notes.create'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const body = await c.req.json()
      const { fileName, mimeType, noteId } = body
      const ext = fileName?.split('.')?.pop()?.toLowerCase() ?? 'jpg'
      const key = `notes/${userId}/${noteId ?? 'draft'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error } = await supabaseAdmin.storage.from('atlas-notes').createSignedUploadUrl(key)
      if (error) return c.json({ error: error.message }, 500)
      return c.json({ uploadUrl: data.signedUrl, objectKey: key, token: data.token }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // NOTES CRUD
  // ================================================================

  // GET /notes
  app.get('/notes', requirePermission('notes.notes.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const { folderId, tagId, q, archived, trashed, shared, page, pageSize } = c.req.query()
      const data = await notes.listNotes({
        userId,
        folderId: folderId || undefined,
        tagId: tagId || undefined,
        q: q || undefined,
        archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
        trashed: trashed === 'true' ? true : trashed === 'false' ? false : undefined,
        shared: shared === 'true' ? true : shared === 'false' ? false : undefined,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? Math.min(parseInt(pageSize, 10), 100) : 30,
      })
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes
  app.post('/notes', requirePermission('notes.notes.create'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const body = await c.req.json()
      const { title, content, folderId, icon, backgroundColor } = body
      const data = await notes.createNote({ userId, companyId, title, content, folderId, icon, backgroundColor })
      return c.json({ data }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // GET /notes/:id
  app.get('/notes/:id', requirePermission('notes.notes.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await notes.getNote(noteId, userId)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/:id
  app.patch('/notes/:id', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const data = await notes.updateNote(noteId, userId, body)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/:id — soft delete (trash)
  app.delete('/notes/:id', requirePermission('notes.notes.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await notes.trashNote(noteId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/:id/restore
  app.post('/notes/:id/restore', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await notes.restoreNote(noteId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/:id/permanent
  app.delete('/notes/:id/permanent', requirePermission('notes.notes.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await notes.permanentDelete(noteId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // Y.js STATE
  // ================================================================

  // GET /notes/:id/ydoc
  app.get('/notes/:id/ydoc', requirePermission('notes.notes.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await ydoc.getState(noteId, userId)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PUT /notes/:id/ydoc
  app.put('/notes/:id/ydoc', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const { state } = body
      const data = await ydoc.saveState(noteId, userId, state)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // TAGS ON NOTES
  // ================================================================

  // PUT /notes/:id/tags — set all tags on a note
  app.put('/notes/:id/tags', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const { tagIds } = body
      const data = await tags.setNoteTags(noteId, userId, tagIds)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/:id/tags/:tagId — remove a single tag from a note
  app.delete('/notes/:id/tags/:tagId', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const tagId = c.req.param('tagId')
      const data = await tags.removeNoteTag(noteId, tagId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // SHARES
  // ================================================================

  // GET /notes/:id/shares
  app.get('/notes/:id/shares', requirePermission('notes.shares.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await shares.listShares(noteId, userId)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/:id/shares
  app.post('/notes/:id/shares', requirePermission('notes.shares.create'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const { targetUserId, permission } = body
      const data = await shares.shareNote(noteId, userId, { targetUserId, permission })
      return c.json({ data }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/:id/shares/:shareId
  app.patch('/notes/:id/shares/:shareId', requirePermission('notes.shares.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const shareId = c.req.param('shareId')
      const body = await c.req.json()
      const { permission } = body
      const data = await shares.updateShare(shareId, userId, { permission })
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/:id/shares/:shareId
  app.delete('/notes/:id/shares/:shareId', requirePermission('notes.shares.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const shareId = c.req.param('shareId')
      const data = await shares.revokeShare(shareId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ================================================================
  // PUBLISH / UNPUBLISH
  // ================================================================

  // POST /notes/:id/publish
  app.post('/notes/:id/publish', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await shares.publishNote(noteId, userId)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/:id/unpublish
  app.post('/notes/:id/unpublish', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await shares.unpublishNote(noteId, userId)
      return c.json({ data })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  return app
}
