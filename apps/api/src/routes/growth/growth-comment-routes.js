import { Hono } from 'hono';
import { GrowthCommentsServiceError } from './growth-comments-service.js';

function handleError(c, err) {
  if (err instanceof GrowthCommentsServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('[atlas.growth] comments error', err);
  return c.json({ error: 'Error interno al procesar el comentario.' }, 500);
}

export function createGrowthCommentRoutes({ service, requirePermission }) {
  const app = new Hono();

  app.get('/growth/leads/:id/comments', requirePermission('growth.leads.read'), async (c) => {
    try {
      const companyId = c.get('companyId');
      const comments = await service.listComments(c.req.param('id'), companyId);
      return c.json({ data: comments });
    } catch (err) { return handleError(c, err); }
  });

  app.post('/growth/leads/:id/comments', requirePermission('growth.leads.update'), async (c) => {
    try {
      const companyId  = c.get('companyId');
      const authUserId = c.get('authUserId');
      const { body }   = await c.req.json();
      const result     = await service.createComment(c.req.param('id'), authUserId, body, companyId);
      return c.json({ data: result }, 201);
    } catch (err) { return handleError(c, err); }
  });

  app.patch('/growth/leads/:id/comments/:cid', requirePermission('growth.leads.update'), async (c) => {
    try {
      const authUserId = c.get('authUserId');
      const { body }   = await c.req.json();
      const comment    = await service.updateComment(c.req.param('cid'), authUserId, body);
      return c.json({ data: comment });
    } catch (err) { return handleError(c, err); }
  });

  app.delete('/growth/leads/:id/comments/:cid', requirePermission('growth.leads.update'), async (c) => {
    try {
      const companyId  = c.get('companyId');
      const authUserId = c.get('authUserId');
      await service.deleteComment(c.req.param('cid'), authUserId, companyId);
      return c.json({ success: true });
    } catch (err) { return handleError(c, err); }
  });

  app.post('/growth/leads/:id/comments/:cid/reactions', requirePermission('growth.leads.update'), async (c) => {
    try {
      const authUserId = c.get('authUserId');
      const { emoji }  = await c.req.json();
      const result     = await service.toggleReaction(c.req.param('cid'), authUserId, emoji);
      return c.json({ data: result });
    } catch (err) { return handleError(c, err); }
  });

  return app;
}
