# Himalaya Paints Split Workspace

This repository now contains two separate applications:

- `frontend/` - React + Vite UI
- `backend/` - Node.js + Express API

The codebase has been fully migrated away from the old Next.js/TypeScript stack.

## Development

Run the backend first:

```bash
cd backend
npm install
npm run dev
```

Run the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

## Environment

- Backend development config: `backend/.env.development`
- Backend production config: `backend/.env.production`
- Frontend development config: `frontend/.env.development`
- Frontend production config: `frontend/.env.production`
