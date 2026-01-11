import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required");
  const genAI = new GoogleGenerativeAI(key);
  // Fast & cheap for MVP
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}
