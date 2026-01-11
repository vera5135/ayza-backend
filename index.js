import express from "express";
import routes from "./routes.js";
import { migrateIfNeeded } from "./migrate_if_needed.js";
import { startReminderCron } from "./reminders.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

await migrateIfNeeded();

app.use("/api", routes);

// günlük hatırlatmalar (09:00)
startReminderCron();

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Ayza Backend running on http://localhost:${port}`);
});
