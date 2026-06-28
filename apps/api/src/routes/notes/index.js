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
  // All /notes/* routes — dedicated internal router with auth
  // Public note route is registered in apps/api/src/index.js to
  // guarantee it is never intercepted by auth middleware.
  // ----------------------------------------------------------------
  const internal = new Hono()
  internal.use('*', authMiddleware)

  // Helper — extract userId and companyId from Hono context
  function getAuth(c) {
    const userId = c.get('userContext')?.profile?.id ?? c.get('userId')
    const companyId = c.get('userContext')?.memberships?.[0]?.companyId ?? null
    return { userId, companyId }
  }

  // ==============================================================
  // FOLDERS — register BEFORE /:id to avoid "folders" matching :id
  // ==============================================================

  // GET /notes/folders
  internal.get('/folders', requirePermission('notes.folders.read'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const folders_ = await folders.listFolders({ userId, companyId })
      return c.json({ folders: folders_ })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/folders
  internal.post('/folders', requirePermission('notes.folders.create'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const body = await c.req.json()
      const { name, color, icon, parentFolderId, sortOrder } = body
      const folder = await folders.createFolder({ userId, companyId, name, color, icon, parentFolderId, sortOrder })
      return c.json({ folder }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/folders/:id
  internal.patch('/folders/:id', requirePermission('notes.folders.update'), async (c) => {
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
  internal.delete('/folders/:id', requirePermission('notes.folders.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const folderId = c.req.param('id')
      const data = await folders.deleteFolder(folderId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ==============================================================
  // TAGS — register BEFORE /:id to avoid "tags" matching :id
  // ==============================================================

  // GET /notes/tags
  internal.get('/tags', requirePermission('notes.tags.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const tags_ = await tags.listTags({ userId })
      return c.json({ tags: tags_ })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/tags
  internal.post('/tags', requirePermission('notes.tags.create'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const body = await c.req.json()
      const { name, color } = body
      const tag = await tags.createTag({ userId, companyId, name, color })
      return c.json({ tag }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/tags/:id
  internal.patch('/tags/:id', requirePermission('notes.tags.update'), async (c) => {
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
  internal.delete('/tags/:id', requirePermission('notes.tags.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const tagId = c.req.param('id')
      const data = await tags.deleteTag(tagId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ==============================================================
  // PRESIGN IMAGE — register before /:id
  // ==============================================================

  // POST /notes/presign-image
  internal.post('/presign-image', requirePermission('notes.notes.create'), async (c) => {
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

  // ==============================================================
  // NOTES CRUD
  // ==============================================================

  // GET /notes
  internal.get('/', requirePermission('notes.notes.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const { folderId, tagId, q, archived, trashed, shared, page, pageSize } = c.req.query()
      const notesList = await notes.listNotes({
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
      return c.json({ notes: notesList })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes
  internal.post('/', requirePermission('notes.notes.create'), async (c) => {
    try {
      const { userId, companyId } = getAuth(c)
      const body = await c.req.json()
      const { title, content, folderId, icon, backgroundColor } = body
      const note = await notes.createNote({ userId, companyId, title, content, folderId, icon, backgroundColor })
      return c.json({ note }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // GET /notes/:id
  internal.get('/:id', requirePermission('notes.notes.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const note = await notes.getNote(noteId, userId)
      return c.json({ note })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/:id
  internal.patch('/:id', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const note = await notes.updateNote(noteId, userId, body)
      return c.json({ note })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/:id — soft delete (trash)
  internal.delete('/:id', requirePermission('notes.notes.delete'), async (c) => {
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
  internal.post('/:id/restore', requirePermission('notes.notes.update'), async (c) => {
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
  internal.delete('/:id/permanent', requirePermission('notes.notes.delete'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const data = await notes.permanentDelete(noteId, userId)
      return c.json(data)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // ==============================================================
  // Y.js STATE
  // ==============================================================

  // GET /notes/:id/ydoc
  internal.get('/:id/ydoc', requirePermission('notes.notes.read'), async (c) => {
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
  internal.put('/:id/ydoc', requirePermission('notes.notes.update'), async (c) => {
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

  // ==============================================================
  // TAGS ON NOTES
  // ==============================================================

  // PUT /notes/:id/tags — set all tags on a note
  internal.put('/:id/tags', requirePermission('notes.notes.update'), async (c) => {
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
  internal.delete('/:id/tags/:tagId', requirePermission('notes.notes.update'), async (c) => {
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

  // ==============================================================
  // SHARES
  // ==============================================================

  // GET /notes/:id/shares
  internal.get('/:id/shares', requirePermission('notes.shares.read'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const sharesList = await shares.listShares(noteId, userId)
      return c.json({ shares: sharesList })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/:id/shares
  internal.post('/:id/shares', requirePermission('notes.shares.create'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const body = await c.req.json()
      const { targetUserId, permission } = body
      const share = await shares.shareNote(noteId, userId, { targetUserId, permission })
      return c.json({ share }, 201)
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // PATCH /notes/:id/shares/:shareId
  internal.patch('/:id/shares/:shareId', requirePermission('notes.shares.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const shareId = c.req.param('shareId')
      const body = await c.req.json()
      const { permission } = body
      const share = await shares.updateShare(shareId, userId, { permission })
      return c.json({ share })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // DELETE /notes/:id/shares/:shareId
  internal.delete('/:id/shares/:shareId', requirePermission('notes.shares.delete'), async (c) => {
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

  // ==============================================================
  // PUBLISH / UNPUBLISH
  // ==============================================================

  // POST /notes/:id/publish
  internal.post('/:id/publish', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const note = await shares.publishNote(noteId, userId)
      return c.json({ note })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // POST /notes/:id/unpublish
  internal.post('/:id/unpublish', requirePermission('notes.notes.update'), async (c) => {
    try {
      const { userId } = getAuth(c)
      const noteId = c.req.param('id')
      const note = await shares.unpublishNote(noteId, userId)
      return c.json({ note })
    } catch (e) {
      return c.json({ error: e.message }, e.status ?? 500)
    }
  })

  // Mount the internal (auth-protected) router at /notes
  app.route('/notes', internal)

  return app
}
