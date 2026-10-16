import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// How many app users one broadcast reaches, and how many pushes are in flight at once.
const MAX_USERS = 300;
const BATCH = 6;

// Broadcasts one push notification to every app user who has notifications on.
// Workflows call it when something happens on the platform; it is admin-only.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || !content) {
      return Response.json({ error: 'title and content are required' }, { status: 400 });
    }

    const users = (await base44.asServiceRole.entities.User.list('-created_date', MAX_USERS)) || [];
    // Anyone who switched notifications off in settings is left alone.
    const targets = users.filter((u) => u && u.id && u.push_notifications !== false);

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
      const results = await Promise.allSettled(
        targets.slice(i, i + BATCH).map((target) =>
          base44.asServiceRole.integrations.Core.SendPushNotification({
            user_id: target.id,
            title,
            content,
            action_label: body.action_label || 'Open',
            action_url: body.action_url || undefined,
          })
        )
      );
      for (const result of results) {
        if (result.status === 'fulfilled') sent += 1;
        else failed += 1;
      }
    }

    return Response.json({ targets: targets.length, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}