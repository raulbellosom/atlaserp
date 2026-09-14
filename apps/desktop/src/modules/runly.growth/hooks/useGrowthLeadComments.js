import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

const {
  useComments: useGrowthLeadComments,
  useCreateComment: useCreateGrowthLeadComment,
  useUpdateComment: useUpdateGrowthLeadComment,
  useDeleteComment: useDeleteGrowthLeadComment,
  useToggleReaction: useToggleGrowthLeadCommentReaction,
} = createCommentHooks({
  queryKey: (leadId) => ['growth', 'leads', leadId],
  sdk: {
    list:           (leadId, token) => atlas.growth.listLeadComments(leadId, token),
    create:         (leadId, body, token) => atlas.growth.createLeadComment(leadId, body, token),
    update:         (leadId, commentId, body, token) => atlas.growth.updateLeadComment(leadId, commentId, body, token),
    del:            (leadId, commentId, token) => atlas.growth.deleteLeadComment(leadId, commentId, token),
    toggleReaction: (leadId, commentId, emoji, token) => atlas.growth.toggleLeadCommentReaction(leadId, commentId, emoji, token),
  },
  useAuth,
})

export {
  useGrowthLeadComments,
  useCreateGrowthLeadComment,
  useUpdateGrowthLeadComment,
  useDeleteGrowthLeadComment,
  useToggleGrowthLeadCommentReaction,
}
