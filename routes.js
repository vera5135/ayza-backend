import { Router } from "express";
import multer from "multer";
import fs from "fs";
import pdf from "pdf-parse";
import { db } from "./db.js";
import { documents, events as eventsTable, notifications as notificationsTable } from "./schema.js";
import { eq, desc } from "drizzle-orm";
import { authRequired, login, register } from "./auth.js";
import { getGeminiModel } from "./gemini.js";
import { extractFirstDateTime } from "./extract_event.js";
import { checkQuota, incrementQuota } from "./quota.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/auth/register", register);
router.post("/auth/login", login);

// Upload PDF
router.post("/documents/upload", authRequired, checkQuota, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const originalName = req.file.originalname || "document.pdf";
  const filePath = req.file.path;

  // Extract text (best-effort)
  let extractedText = "";
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdf(dataBuffer);
    extractedText = (parsed.text || "").trim();
  } catch (e) {
    // keep empty; summarize endpoint can mark failed
  }

  const inserted = await db.insert(documents).values({
    userId: req.user.id,
    originalName,
    filePath,
    status: "uploaded",
    extractedText
  }).returning({ id: documents.id, status: documents.status });

  await incrementQuota(req.user.id);
  res.json({ documentId: inserted[0].id, status: inserted[0].status });
});

router.get("/documents", authRequired, async (req, res) => {
  const rows = await db.select().from(documents)
    .where(eq(documents.userId, req.user.id))
    .orderBy(desc(documents.id))
    .limit(50);
  res.json(rows);
});

router.get("/documents/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  if (rows[0].userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  res.json(rows[0]);
});

// Summarize with Gemini + create event + notification
router.post("/ai/summarize/:documentId", authRequired, async (req, res) => {
  const documentId = Number(req.params.documentId);
  const rows = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  const doc = rows[0];
  if (doc.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  if (!doc.extractedText || doc.extractedText.trim().length < 20) {
    await db.update(documents).set({ status: "failed" }).where(eq(documents.id, documentId));
    return res.status(400).json({ error: "Metin çıkarılamadı. PDF'i Yazdır->PDF olarak yeniden üretip tekrar yükleyin." });
  }

  await db.update(documents).set({ status: "processing" }).where(eq(documents.id, documentId));

  const model = getGeminiModel();

  const prompt = `
Sen bir hukuk asistanısın. Kesin hüküm ve hukuki danışmanlık verme.
Sadece BELGEYİ özetle ve varsa duruşma/tarih/saat/mahkeme bilgilerini tespit et.
Çıktı formatı:
1) Kısa Özet (5-7 madde)
2) Kritik Tarihler (varsa)
3) Belgeden doğrudan alıntı yok; yorum yok.

Belge Metni:
---
${doc.extractedText.slice(0, 12000)}
---
`;

  let summaryText = "";
  try {
    const result = await model.generateContent(prompt);
    summaryText = result.response.text().trim();
  } catch (e) {
    await db.update(documents).set({ status: "failed" }).where(eq(documents.id, documentId));
    return res.status(500).json({ error: "Gemini çağrısı başarısız" });
  }

  await db.update(documents).set({ summary: summaryText, status: "summarized" }).where(eq(documents.id, documentId));

  // Extract event time (best-effort)
  const eventAt = extractFirstDateTime(doc.extractedText);
  let createdEvent = null;

  if (eventAt) {
    const evIns = await db.insert(eventsTable).values({
      userId: req.user.id,
      documentId,
      title: "Duruşma / İşlem",
      eventAt,
      description: summaryText
    }).returning({ id: eventsTable.id, eventAt: eventsTable.eventAt });

    createdEvent = evIns[0];

    await db.insert(notificationsTable).values({
      userId: req.user.id,
      title: "Yeni etkinlik bulundu",
      message: `Belgede tarih tespit edildi: ${eventAt.toISOString()}`
    });
  } else {
    await db.insert(notificationsTable).values({
      userId: req.user.id,
      title: "Özet hazır",
      message: "Belge özetlendi. Etkinlik tarihi net bulunamadı; kontrol edip manuel ekleyin."
    });
  }

  res.json({ summary: summaryText, event: createdEvent });
});

router.get("/events", authRequired, async (req, res) => {
  const rows = await db.select().from(eventsTable)
    .where(eq(eventsTable.userId, req.user.id))
    .orderBy(desc(eventsTable.id))
    .limit(100);
  res.json(rows);
});

router.get("/notifications", authRequired, async (req, res) => {
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user.id))
    .orderBy(desc(notificationsTable.id))
    .limit(100);
  res.json(rows);
});

export default router;
