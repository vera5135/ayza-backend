import cron from "node-cron";
import dayjs from "dayjs";
import { db } from "./db.js";
import { events, notifications } from "./schema.js";
import { and, eq, gte, lt } from "drizzle-orm";

async function createReminderForRange(userId, start, end, titlePrefix) {
  const upcoming = await db.select().from(events)
    .where(and(eq(events.userId, userId), gte(events.eventAt, start), lt(events.eventAt, end)));

  for (const e of upcoming) {
    await db.insert(notifications).values({
      userId,
      title: `${titlePrefix}: ${e.title}`,
      message: `Hatırlatma: ${dayjs(e.eventAt).format("DD.MM.YYYY HH:mm")} - ${e.title}`
    });
  }
}

export function startReminderCron() {
  // Her gün 09:00 (server TZ'ye göre)
  cron.schedule("0 9 * * *", async () => {
    try {
      // MVP: tüm kullanıcıların event'leri için bildirim üret (küçük pilotta yeter)
      // Optimize sonra.
      const userIds = await db.execute("SELECT DISTINCT user_id as id FROM events");
      const ids = userIds.rows?.map(r => r.id) || [];

      const now = dayjs();
      const tomorrowStart = now.add(1, "day").startOf("day").toDate();
      const tomorrowEnd = now.add(1, "day").endOf("day").toDate();

      const weekStart = now.add(7, "day").startOf("day").toDate();
      const weekEnd = now.add(7, "day").endOf("day").toDate();

      for (const userId of ids) {
        await createReminderForRange(userId, tomorrowStart, tomorrowEnd, "Yarın");
        await createReminderForRange(userId, weekStart, weekEnd, "7 gün kaldı");
      }
    } catch (e) {
      console.error("Reminder cron error:", e);
    }
  });
}
