import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { runly } from '../../../lib/atlas'

const {
  useComments: useInventoryComments,
  useCreateComment: useCreateInventoryComment,
  useUpdateComment: useUpdateInventoryComment,
  useDeleteComment: useDeleteInventoryComment,
  useToggleReaction: useToggleInventoryReaction,
} = createCommentHooks({
  queryKey: (itemId) => ['inventory', 'items', itemId],
  sdk: {
    list:           (itemId, token) => runly.inventory.listComments(itemId, token),
    create:         (itemId, body, token) => runly.inventory.createComment(itemId, { body }, token),
    update:         (itemId, commentId, body, token) => runly.inventory.updateComment(itemId, commentId, { body }, token),
    del:            (itemId, commentId, token) => runly.inventory.deleteComment(itemId, commentId, token),
    toggleReaction: (itemId, commentId, emoji, token) => runly.inventory.toggleReaction(itemId, commentId, { emoji }, token),
  },
  useAuth,
})

export {
  useInventoryComments,
  useCreateInventoryComment,
  useUpdateInventoryComment,
  useDeleteInventoryComment,
  useToggleInventoryReaction,
}
