import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { runly } from '../../../lib/runly'

const {
  useComments: useGrowthLeadComments,
  useCreateComment: useCreateGrowthLeadComment,
  useUpdateComment: useUpdateGrowthLeadComment,
  useDeleteComment: useDeleteGrowthLeadComment,
  useToggleReaction: useToggleGrowthLeadCommentReaction,
} = createCommentHooks({
  queryKey: (leadId) => ['growth', 'leads', leadId],
  sdk: {
    list:           (leadId, token) => runly.growth.listLeadComments(leadId, token),
    create:         (leadId, body, token) => runly.growth.createLeadComment(leadId, body, token),
    update:         (leadId, commentId, body, token) => runly.growth.updateLeadComment(leadId, commentId, body, token),
    del:            (leadId, commentId, token) => runly.growth.deleteLeadComment(leadId, commentId, token),
    toggleReaction: (leadId, commentId, emoji, token) => runly.growth.toggleLeadCommentReaction(leadId, commentId, emoji, token),
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
