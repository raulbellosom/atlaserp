import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

const {
  useComments: useInventoryComments,
  useCreateComment: useCreateInventoryComment,
  useUpdateComment: useUpdateInventoryComment,
  useDeleteComment: useDeleteInventoryComment,
  useToggleReaction: useToggleInventoryReaction,
} = createCommentHooks({
  queryKey: (itemId) => ['inventory', 'items', itemId],
  sdk: {
    list:           (itemId, token) => atlas.inventory.listComments(itemId, token),
    create:         (itemId, body, token) => atlas.inventory.createComment(itemId, { body }, token),
    update:         (itemId, commentId, body, token) => atlas.inventory.updateComment(itemId, commentId, { body }, token),
    del:            (itemId, commentId, token) => atlas.inventory.deleteComment(itemId, commentId, token),
    toggleReaction: (itemId, commentId, emoji, token) => atlas.inventory.toggleReaction(itemId, commentId, { emoji }, token),
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
