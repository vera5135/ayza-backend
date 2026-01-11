import dayjs from "dayjs";
import { db } from "./db.js";
import { usage } from "./schema.js";
import { eq, and } from "drizzle-orm";

const MONTHLY_LIMIT = 100;

export async function checkQuota(req, res, next) {
  const ym = dayjs().format("YYYY-MM");
  const userId = req.user.id;

  let rows = await db.select().from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.yearMonth, ym)))
    .limit(1);

  if (!rows.length) {
    const ins = await db.insert(usage)
      .values({ userId, yearMonth: ym, documentsUsed: 0 })
      .returning();
    rows = [ins[0]];
  }

  if (rows[0].documentsUsed >= MONTHLY_LIMIT) {
    return res.status(402).json({
      error: "Bu ay belge işleme sınırına ulaşıldı."
    });
  }

  next();
}

export async function incrementQuota(userId) {
  const ym = dayjs().format("YYYY-MM");
  await db.execute(
    "UPDATE usage SET documents_used = documents_used + 1 WHERE user_id = $1 AND year_month = $2",
    [userId, ym]
  );
}
