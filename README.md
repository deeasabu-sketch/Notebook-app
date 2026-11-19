# Secure Notes

A small full-stack note app built for the Secure Note-Taking Application interview task. It uses Express, MongoDB/Mongoose, JWT authentication, bcrypt password hashing, and a vanilla JavaScript frontend.

## Features

- Registration and login with JWTs; public registration always creates a `user`.
- Users can create, list, edit, and delete only their own notes.
- Admins can create, list, update, and delete users, view all notes, and group users by interests.
- Authenticated users can publish posts; a public profile endpoint returns a user's posts.
- Paginated list endpoints and query indexes declared with `schema.index()`.

## Setup

Requires Node.js and a reachable MongoDB deployment. From this directory:

```sh
npm install
```

Copy `.env.example` to `.env`, then set a MongoDB URI, a long random `JWT_SECRET`, and private bootstrap admin credentials. `ADMIN_PASSWORD` must be at least 12 characters. Keep `.env` private; it is ignored by Git.

Create the initial administrator once, if one does not already exist:

```sh
node createAdmin.js
```

The script is idempotent by email and will not create a duplicate. Start the app:

```sh
npm start
```

Open `http://localhost:5000/` (or the configured `PORT`). Register at `/register.html`; log in at `/login.html`. The existing admin uses the credentials configured in `.env` if the bootstrap script created that account. No database is dropped or reset by the app.

## API

All JSON responses have `success` and `message` fields where applicable, and payloads are returned in `data`. Protected routes need `Authorization: Bearer <token>`. Admin routes also require the current database user to have the `admin` role.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a normal user; accepts name, email, password, optional interests |
| POST | `/api/auth/login` | Public | Verify credentials and return JWT plus safe user fields |
| POST | `/api/notes` | User | Create a note owned by the signed-in user |
| GET | `/api/notes?page=1&limit=10` | User | Paginated own notes, newest first |
| GET | `/api/notes/:id` | User | Read an owned note |
| PUT | `/api/notes/:id` | User | Update title and/or content of an owned note |
| DELETE | `/api/notes/:id` | User | Delete an owned note |
| GET | `/api/admin/users?page=1&limit=10` | Admin | Paginated safe user listing |
| POST | `/api/admin/users` | Admin | Create user (admin may assign `user` or `admin`) |
| PUT | `/api/admin/users/:id` | Admin | Update name, email, role, or interests |
| DELETE | `/api/admin/users/:id` | Admin | Delete user and their notes/posts; self and last admin are protected |
| GET | `/api/admin/notes?page=1&limit=10` | Admin | Paginated notes with owner name/email |
| GET | `/api/aggregation/interests?page=1&limit=10` | Admin | Paginated groups of users by profile interest |
| POST | `/api/posts` | User | Create a public post under the current user |
| GET | `/api/posts?page=1&limit=10` | Public | Paginated public feed with author name |
| GET | `/api/aggregation/users/:id/posts` | Public | Return a profile summary and that user's posts |

List `limit` defaults to 10 and is capped at 100. Example: `GET /api/notes?page=2&limit=20`; list responses include `pagination.total`, `page`, `limit`, and `totalPages`.

## Indexes and query plans

- `User.email` is unique to enforce one account per normalized email.
- `{ createdAt: -1, _id: -1 }` on users supports deterministic newest-first admin pagination.
- `{ userId: 1, createdAt: -1, _id: -1 }` on notes supports a user's newest-first note list.
- `{ createdAt: -1, _id: -1 }` on notes supports the admin's global newest-first note list.
- `{ userId: 1 }` on posts supports the `$lookup` join from users to posts.
- `{ createdAt: -1, _id: -1 }` on posts supports newest-first public feed pagination.
- No interests index is declared: this endpoint groups all users' array values, and an index would not remove the collection-wide unwind/group work for that aggregation.
- MongoDB provides `_id` indexes automatically. No separate `_id` indexes are declared.

To inspect a list query on a development database, run an equivalent diagnostic in `mongosh`, such as `db.notes.find({userId: ObjectId("...")}).sort({createdAt:-1,_id:-1}).limit(10).explain("executionStats")`. `nReturned` is the number of results produced; `totalKeysExamined` is the number of index entries scanned; `totalDocsExamined` is the number of documents scanned. Lower scan counts relative to results generally indicate a more selective plan. Aggregation controller actions intentionally contain only their required one aggregate call; run diagnostics separately.

## Aggregations

`GET /api/aggregation/interests` makes exactly one `User.aggregate([...])` call: it filters to non-empty interest arrays, unwinds each interest, groups user summaries and counts per interest, sorts groups, and uses `$facet` branches for the requested `$skip`/`$limit` page and total count. It does not fetch password fields or issue a second query.

`GET /api/aggregation/users/:id/posts` validates the id, then makes exactly one `User.aggregate([...])` call. Its pipeline matches the profile and uses `$lookup` from `Post.collection.name`, joining user `_id` to post `userId`. It returns 404 when no profile matches.

## Browser checklist

1. Register a user with comma-separated interests and confirm there is no role selector.
2. Log in; create, refresh, edit, and delete a note.
3. Use a second account to verify the first account's note cannot be accessed by its ID.
4. Log in as the configured admin; browse users and notes, create/edit/delete a user, and view grouped interests.
5. Create a post as an authenticated user; from the admin page, paste that user's MongoDB id into the public posts lookup form.
6. Verify missing/invalid tokens return 401 and a normal user receives 403 on admin endpoints.

The browser stores the demonstration JWT in `localStorage`. A production deployment should consider secure, HttpOnly, SameSite cookies and CSRF protection based on its authentication architecture.

## Verification

Run `npm run vercel-build` to copy the editable frontend assets into `public/`. Run `npm run test:api` with a reachable test MongoDB in `.env` and valid `ADMIN_EMAIL` / `ADMIN_PASSWORD` values to exercise the API flows and inspect execution statistics for the user's notes query. The script creates uniquely named temporary test users and removes their notes, posts, and accounts in cleanup. Admin account deletion in the test requires MongoDB transactions (replica set or sharded cluster). The browser checklist above can be exercised at `/login.html`, `/register.html`, `/dashboard.html`, `/admin.html`, and `/public-posts.html` after starting the server.

## Deploy to Vercel

The app exports the Express instance from the root `app.js`, which Vercel recognizes as an Express entry point. `npm run vercel-build` copies the source frontend in `frontend/` into `public/`, where Vercel serves static assets from its CDN. The app keeps `frontend/` as the editable source and the build command refreshes the deployment copy.

1. Push this project to a Git repository and import it into Vercel, or deploy it with the Vercel CLI.
2. Keep the project root as the Vercel Root Directory. The checked-in `vercel.json` sets the frontend copy build command; no separate output directory is needed.
3. Add `MONGO_URI`, `JWT_SECRET`, and `JWT_EXPIRES_IN` to Vercel Project Settings → Environment Variables for the environments you will use. `PORT` is unnecessary on Vercel. Do not upload `.env` or put secrets in source files.
4. Ensure your MongoDB provider allows connections from the deployed function. For MongoDB Atlas, configure Network Access appropriately for your deployment; broad public IP access is less restrictive but increases exposure.
5. Deploy, then open the Vercel URL. The app and `/api/*` use the same origin, so the frontend's relative API URLs need no separate API host configuration.

Mongoose connections are established lazily on API requests and reused by warm function instances. Database connection failures return HTTP 503 without terminating the Vercel function. Vercel serves files from `public/`; `express.static()` remains enabled only as the local development fallback. Mongoose 9 requires Node.js 20.19.0 or newer.

## Known limitations

- Admin account deletion uses MongoDB transactions so user, notes, and posts deletion is atomic; transactions require a replica set or sharded MongoDB deployment. On standalone MongoDB, this operation returns an error without intentionally falling back to partial deletion.
- The browser interface is intentionally minimal and provides first-page admin note viewing; the API itself supports pagination for every list.
