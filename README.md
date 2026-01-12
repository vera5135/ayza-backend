# Ayza Backend (DB + Gemini) – Hızlı MVP

## Gerekenler
- Node.js 20+
- PostgreSQL

## ENV
`.env` yerine doğrudan environment variable verebilirsin:

- `DATABASE_URL=postgres://user:pass@host:5432/dbname`
- `JWT_SECRET=super-secret`
- `GEMINI_API_KEY=...`
- (opsiyonel) `PORT=3000`

## Kurulum
```bash
npm install
npm run migrate
npm run dev
```

## API (özet)
### Auth
- POST `/api/auth/register` {email,password,name?}
- POST `/api/auth/login` {email,password} -> {token}

### Documents
- POST `/api/documents/upload` (multipart form-data: `file`)  [Auth]
- GET  `/api/documents` [Auth]
- GET  `/api/documents/:id` [Auth]

### AI
- POST `/api/ai/summarize/:documentId` [Auth]

### Events / Notifications
- GET `/api/events` [Auth]
- GET `/api/notifications` [Auth]

## Not
Bu MVP sürümünde:
- CaseFile mantığı minimum (isteğe bağlı eklenir)
- UDF -> PDF rehberi UI tarafında yapılacak
