// Read-only diagnostics. No recipients, message bodies, secrets, or sends.
// Run: node --env-file=.env scripts/diagnose-notifications.mjs
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createSmtpService } from '../apps/api/src/services/smtp-service.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const timeout = setTimeout(() => {
  console.error('Notification diagnostics timed out connecting to the database.');
  process.exit(1);
}, 20000);
try {
  const since = new Date(Date.now() - 7 * 86400000);
  const [events, deliveries, subscriptions, configuration, preferences, failures, projectInvites] = await Promise.all([
    prisma.notification.groupBy({ by: ['eventType'], where: { createdAt: { gte: since } }, _count: true }),
    prisma.notificationDelivery.groupBy({ by: ['channel', 'status'], _count: true, _min: { createdAt: true } }),
    prisma.pushSubscription.count({ where: { enabled: true } }),
    prisma.instanceConfig.findMany({ where: { key: { in: ['smtp.host', 'smtp.user', 'smtp.pass', 'notifications.webpush.vapid.subject', 'notifications.webpush.vapid.public_key', 'notifications.webpush.vapid.private_key'] } }, select: { key: true, value: true } }),
    prisma.notificationPreference.groupBy({ by: ['eventType', 'inAppEnabled', 'emailEnabled', 'pushEnabled'], _count: true }),
    prisma.notificationDelivery.findMany({ where: { status: 'failed' }, select: { channel: true, lastError: true } }),
    prisma.notification.findMany({ where: { eventType: 'projects.member.added', createdAt: { gte: since } }, select: { userId: true, companyId: true, createdAt: true, readAt: true, deliveries: { select: { channel: true, status: true } } } }),
  ]);
  const failureCategories = {};
  for (const failure of failures) {
    const error = failure.lastError ?? '';
    const reason = /no configurado|not configured/i.test(error) ? 'not_configured'
      : /suscripciones push activas/i.test(error) ? 'no_active_subscription'
      : /decrypt|authenticate data|bad decrypt/i.test(error) ? 'credential_decryption'
      : /401|403|410|404|VAPID/i.test(error) ? 'push_subscription_or_vapid'
      : /auth|535|credentials/i.test(error) ? 'authentication'
      : /timeout|ETIMEDOUT|ECONN/i.test(error) ? 'connection'
      : 'other';
    const key = `${failure.channel}:${reason}`;
    failureCategories[key] = (failureCategories[key] ?? 0) + 1;
  }
  let smtpCredentialsReadable = false;
  try { smtpCredentialsReadable = await createSmtpService({ prisma }).isConfigured(); } catch {}
  const inviteDiagnostics = [];
  for (const invite of projectInvites) {
    const membership = await prisma.membership.findFirst({ where: { userId: invite.userId, enabled: true }, orderBy: { createdAt: 'desc' }, select: { companyId: true } });
    const newerCount = await prisma.notification.count({ where: { userId: invite.userId, companyId: invite.companyId, createdAt: { gt: invite.createdAt } } });
    const { userId, companyId, ...safeInvite } = invite;
    inviteDiagnostics.push({ ...safeInvite, companyMatchesInbox: membership?.companyId === companyId, newerNotifications: newerCount });
  }
  console.log(JSON.stringify({ eventsLastSevenDays: events, projectInvitesLastSevenDays: inviteDiagnostics, deliveries, failureCategories, smtpCredentialsReadable, activePushSubscriptions: subscriptions, configuration: configuration.map(row => ({ key: row.key, configured: Boolean(row.value) })), savedPreferences: preferences }, null, 2));
} catch (error) {
  console.error('Read-only notification diagnostics failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await prisma.$disconnect();
}
