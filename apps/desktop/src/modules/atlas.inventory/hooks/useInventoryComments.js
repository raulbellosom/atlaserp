import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useInventoryComments(itemId) {
  const token = useToken()
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'comments'],
    queryFn: () => atlas.inventory.listComments(itemId, token),
    enabled: Boolean(token) && Boolean(itemId),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useCreateInventoryComment(itemId) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const qc = useQueryClient()
  const commentsKey = ['inventory', 'items', itemId, 'comments']
  return useMutation({
    mutationFn: (data) => atlas.inventory.createComment(itemId, data, token),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: commentsKey })
      const prev = qc.getQueryData(commentsKey)
      const tempComment = {
        id: `_temp_${Date.now()}`,
        body: data.body,
        authorId: userProfile?.id,
        author: userProfile,
        createdAt: new Date().toISOString(),
        editedAt: null,
        reactions: [],
        _pending: true,
      }
      qc.setQueryData(commentsKey, (old) => {
        if (!old) return [tempComment]
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = [...list, tempComment]
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(commentsKey, ctx.prev)
      toast.error(err?.message ?? 'Error al publicar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: commentsKey })
    },
  })
}

export function useUpdateInventoryComment(itemId) {
  const token = useToken()
  const qc = useQueryClient()
  const commentsKey = ['inventory', 'items', itemId, 'comments']
  return useMutation({
    mutationFn: ({ commentId, ...data }) =>
      atlas.inventory.updateComment(itemId, commentId, data, token),
    onMutate: async ({ commentId, body }) => {
      await qc.cancelQueries({ queryKey: commentsKey })
      const prev = qc.getQueryData(commentsKey)
      qc.setQueryData(commentsKey, (old) => {
        if (!old) return old
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = list.map(c =>
          c.id === commentId ? { ...c, body, editedAt: new Date().toISOString() } : c
        )
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(commentsKey, ctx.prev)
      toast.error(err?.message ?? 'Error al editar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: commentsKey })
    },
  })
}

export function useDeleteInventoryComment(itemId) {
  const token = useToken()
  const qc = useQueryClient()
  const commentsKey = ['inventory', 'items', itemId, 'comments']
  return useMutation({
    mutationFn: (commentId) =>
      atlas.inventory.deleteComment(itemId, commentId, token),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: commentsKey })
      const prev = qc.getQueryData(commentsKey)
      qc.setQueryData(commentsKey, (old) => {
        if (!old) return old
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = list.filter(c => c.id !== commentId)
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(commentsKey, ctx.prev)
      toast.error(err?.message ?? 'Error al eliminar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: commentsKey })
    },
  })
}

export function useToggleInventoryReaction(itemId) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const qc = useQueryClient()
  const commentsKey = ['inventory', 'items', itemId, 'comments']

  return useMutation({
    mutationFn: ({ commentId, emoji }) =>
      atlas.inventory.toggleReaction(itemId, commentId, { emoji }, token),

    onMutate: async ({ commentId, emoji }) => {
      await qc.cancelQueries({ queryKey: commentsKey })
      const prev = qc.getQueryData(commentsKey)

      qc.setQueryData(commentsKey, old => {
        if (!old) return old
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = list.map(c => {
          if (c.id !== commentId) return c
          const mine = c.reactions?.some(r => r.userId === userProfile?.id && r.emoji === emoji)
          const reactions = mine
            ? c.reactions.filter(r => !(r.userId === userProfile?.id && r.emoji === emoji))
            : [...(c.reactions ?? []), {
                id: '_opt',
                commentId,
                userId: userProfile?.id,
                emoji,
                user: userProfile ?? null,
              }]
          return { ...c, reactions }
        })
        return old?.data ? { ...old, data: updated } : updated
      })

      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(commentsKey, ctx.prev)
      toast.error('No se pudo actualizar la reaccion')
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: commentsKey })
    },
  })
}
