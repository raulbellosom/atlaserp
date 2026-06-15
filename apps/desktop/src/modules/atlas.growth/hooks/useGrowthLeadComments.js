import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

function commentsKey(leadId) {
  return ['growth', 'leads', leadId, 'comments']
}

export function useGrowthLeadComments(leadId) {
  const token = useToken()
  return useQuery({
    queryKey: commentsKey(leadId),
    queryFn: () => atlas.growth.listLeadComments(leadId, token),
    enabled: Boolean(token) && Boolean(leadId),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useCreateGrowthLeadComment(leadId) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const qc = useQueryClient()
  const key = commentsKey(leadId)
  return useMutation({
    mutationFn: ({ body }) => atlas.growth.createLeadComment(leadId, body, token),
    onMutate: async ({ body }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      const tempComment = {
        id: `_temp_${Date.now()}`,
        body,
        authorId: userProfile?.id,
        author: userProfile,
        createdAt: new Date().toISOString(),
        editedAt: null,
        reactions: [],
        _pending: true,
      }
      qc.setQueryData(key, (old) => {
        if (!old) return [tempComment]
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = [...list, tempComment]
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
      toast.error(err?.message ?? 'Error al publicar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useUpdateGrowthLeadComment(leadId) {
  const token = useToken()
  const qc = useQueryClient()
  const key = commentsKey(leadId)
  return useMutation({
    mutationFn: ({ commentId, body }) => atlas.growth.updateLeadComment(leadId, commentId, body, token),
    onMutate: async ({ commentId, body }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => {
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
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
      toast.error(err?.message ?? 'Error al editar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useDeleteGrowthLeadComment(leadId) {
  const token = useToken()
  const qc = useQueryClient()
  const key = commentsKey(leadId)
  return useMutation({
    mutationFn: (commentId) => atlas.growth.deleteLeadComment(leadId, commentId, token),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => {
        if (!old) return old
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = list.filter(c => c.id !== commentId)
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
      toast.error(err?.message ?? 'Error al eliminar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useToggleGrowthLeadCommentReaction(leadId) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const qc = useQueryClient()
  const key = commentsKey(leadId)
  return useMutation({
    mutationFn: ({ commentId, emoji }) =>
      atlas.growth.toggleLeadCommentReaction(leadId, commentId, emoji, token),
    onMutate: async ({ commentId, emoji }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, old => {
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
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
      toast.error('No se pudo actualizar la reaccion')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}
