// Native push alert for app users.
//
// Called by the "Launch Push" workflow right after a new token is listed, and by
// admins from the dashboard. Every app user gets the alert on their phone; a
// single undeliverable device never fails the run, the counts come back instead.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// A Worker holds six connections at once, so sends go out in small batches.
const BATCH = 6;

const reply = (body, status = 200) => Response.json(body, { status });

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || !content) {
      return reply({ error: 'title and content are required' }, 400);
    }

    // The launch workflow calls this with the platform's own credentials and no
    // app-user session; a signed-in caller must be an admin.
    const user = await base44.auth
      .me()
      .catch((error) => (error.status === 401 ? null : Promise.reject(error)));
    if (user && user.role !== 'admin') {
      return reply({ error: 'Forbidden' }, 403);
    }

    const users = await base44.asServiceRole.entities.User.list();
    const recipients = (users || []).map((u) => u && u.id).filter(Boolean);

    const alert = { title, content };
    if (body.action_label) alert.action_label = String(body.action_label);
    if (body.action_url) alert.action_url = String(body.action_url);

    let sent = 0;
    const failures = [];

    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((user_id) =>
          base44.asServiceRole.integrations.Core.SendPushNotification({ user_id, ...alert })
        )
      );
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sent += 1;
        } else {
          failures.push({
            user_id: batch[index],
            error: result.reason?.message || String(result.reason),
          });
        }
      });
    }

    // A failed device is reported, not thrown: the launch itself already succeeded.
    return reply({
      recipients: recipients.length,
      sent,
      failed: failures.length,
      errors: failures.slice(0, 3),
    });
  } catch (error) {
    return reply({ error: error.message }, 500);
  }
}