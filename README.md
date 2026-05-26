# Himalaya Paints Dashboard

Full-stack role-based dashboard built with Next.js, Tailwind CSS, MongoDB, and JWT auth.

## Roles

- Admin
- User

## Demo accounts

- Admin: `admin@example.com` / `Password123!`
- User: `user@example.com` / `Password123!`

## Features

- Protected routes with JWT cookie auth
- Admin master-data table with live calculations
- Admin row-level save actions and CSV / Excel / PDF export
- User percentage distribution table
- User pack-size calculator
- CRUD APIs for admin items
- Responsive sidebar dashboard UI
- Toast notifications and loading states

## Environment

Create a `.env.local` from `.env.example`.

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/himalayapaints
JWT_SECRET=replace-with-a-long-random-secret
```

`JWT_SECRET` is required at runtime. The app will throw if it is missing.
Make sure MongoDB is running locally if you use the default `MONGODB_URI`.

## Main routes

- `/login`
- `/admin`
- `/user`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/items`
- `/api/admin/items`
- `/api/admin/items/[id]`

## Notes

- Admin items are stored in MongoDB.
- Users only read admin master data and can enter their own production inputs.
- Quantity fields are treated as KG and amounts are calculated as `Quantity × Rate`.
