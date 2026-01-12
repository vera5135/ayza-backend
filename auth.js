import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "./db.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

export function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export async function register(req, res) {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, name } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const inserted = await db.insert(users).values({ email, name, passwordHash }).returning({ id: users.id, email: users.email });
    const user = inserted[0];
    return res.json({ token: signToken(user) });
  } catch (e) {
    return res.status(400).json({ error: "Email already used" });
  }
}

export async function login(req, res) {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!found.length) return res.status(401).json({ error: "Invalid credentials" });

  const user = found[0];
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  return res.json({ token: signToken(user) });
}
