import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProjectsNotificationService } from "../projects-notification-service.js";

const COMPANY_ID  = "01971a2b-0000-7000-8000-000000000001";
const ACTOR_ID    = "01971a2b-0000-7000-8000-000000000002";
const USER_A      = "01971a2b-0000-7000-8000-000000000003";
const TASK_ID     = "01971a2b-0000-7000-8000-000000000010";
const PROJECT_ID  = "01971a2b-0000-7000-8000-000000000020";
const STATUS_A_ID = "01971a2b-0000-7000-8000-000000000030";
const STATUS_B_ID = "01971a2b-0000-7000-8000-000000000031";

function buildPrismaMock() {
  const published = [];

  const fakeTask = {
    id: TASK_ID,
    title: "Tarea de prueba",
    taskNumber: 42,
    projectId: PROJECT_ID,
    project: { id: PROJECT_ID, name: "Proyecto X", companyId: COMPANY_ID },
    assignees: [{ userId: USER_A }],
  };

  const fakeProject = { id: PROJECT_ID, name: "Proyecto X" };

  return {
    task: { findFirst: async () => fakeTask },
    project: { findFirst: async () => fakeProject },
    taskStatus: {
      findFirst: async ({ where }) =>
        where.id === STATUS_A_ID ? { name: "Por hacer" } : { name: "En progreso" },
    },
    // findMany: used by resolveRecipientUserIds inside notifSvc.publish
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      findMany: async ({ where }) => {
        const ids = where?.userId?.in ?? [];
        return ids.map((id) => ({ userId: id }));
      },
    },
    $transaction: async (fn) =>
      fn({
        notification: {
          findFirst: async () => null,
          create: async ({ data }) => {
            published.push(data);
            return { id: "notif-1", ...data };
          },
        },
        notificationDelivery: { createMany: async () => {} },
      }),
    _published: published,
  };
}

describe("createProjectsNotificationService", () => {
  it("notifyTaskAssigned uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskAssigned({ companyId: COMPANY_ID, actorId: ACTOR_ID, taskId: TASK_ID, assignedUserId: USER_A });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyTaskUnassigned uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskUnassigned({ companyId: COMPANY_ID, actorId: ACTOR_ID, taskId: TASK_ID, removedUserId: USER_A });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyTaskComment uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskComment({ companyId: COMPANY_ID, authorId: ACTOR_ID, taskId: TASK_ID });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyTaskStatusChanged uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskStatusChanged({
      companyId: COMPANY_ID,
      actorId: ACTOR_ID,
      taskId: TASK_ID,
      oldStatusId: STATUS_A_ID,
      newStatusId: STATUS_B_ID,
    });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyMemberAdded uses ?open=project:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyMemberAdded({ companyId: COMPANY_ID, actorId: ACTOR_ID, projectId: PROJECT_ID, addedUserId: USER_A });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=project:${PROJECT_ID}`), `got: ${link}`);
  });
});
