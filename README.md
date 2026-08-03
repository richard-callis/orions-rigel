# Technical Training

A training platform for hands-on technical courses. Every lesson ships with a
live, in-browser database, and every lesson doubles as a full-screen slide
deck for teaching — same content, no separate slides to maintain.

## Features

- **Course content in MDX** — lessons live under `src/content/courses/`, no CMS
- **Live SQL playground** — [PGlite](https://pglite.dev) (Postgres compiled to
  WASM) runs a real, isolated Postgres instance in each learner's browser tab,
  seeded from `public/sql/schema.sql`. No shared server, no rate limits,
  nothing for one student to break for another. Code blocks in a lesson can be
  run directly against it or copied into your own queries. Signed-in users
  can save queries they write and reload them later.
- **Presentation mode** — `/present/<course>/<module>` renders the same
  lesson as full-screen slides with keyboard navigation (arrow keys), split
  automatically from the lesson's `##`/`###` headings and `---` dividers.
- **Accounts + progress tracking** — sign up, mark modules complete, and pick
  up where you left off from the dashboard.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [Auth.js v5](https://authjs.dev) — credentials provider, JWT sessions
- [Prisma 7](https://www.prisma.io) + PostgreSQL (app data: users, progress)
- [PGlite](https://pglite.dev) — the in-browser database learners query
- Tailwind CSS v4 + `@tailwindcss/typography`
- `next-mdx-remote` for MDX rendering, `@uiw/react-codemirror` for the editor

## Getting started

### 1. Prerequisites

- Node.js 20.9+ (see `package.json` engines if you add one)
- A local PostgreSQL server (for app data — user accounts & progress; this is
  separate from the in-browser PGlite database learners query)

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Create a database and a role for the app:

```bash
sudo -u postgres psql -c "CREATE USER training_app WITH PASSWORD 'training_dev_password';"
sudo -u postgres psql -c "CREATE DATABASE technical_training OWNER training_app;"
sudo -u postgres psql -c "ALTER USER training_app CREATEDB;" # needed for prisma migrate's shadow database
```

Copy `.env.example` to `.env` and adjust `DATABASE_URL` if you used different
credentials, then run the migration:

```bash
cp .env.example .env
npx prisma migrate dev
```

### 4. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Adding a course

1. Create `src/content/courses/<course-slug>/course.json`:

   ```json
   {
     "title": "Course Title",
     "tagline": "One-line hook",
     "description": "A couple of sentences about the course."
   }
   ```

2. Add modules as `src/content/courses/<course-slug>/NN-slug.mdx` (the `NN-`
   prefix controls ordering and is stripped from the URL), with frontmatter:

   ```mdx
   ---
   title: "Module Title"
   description: "One line for the module list."
   level: "foundations" # setup | foundations | intermediate | mastery | reference
   duration: "30-45 min" # optional
   ---

   Lesson content here. Use `##`/`###` headings and `---` dividers to control
   how Presentation mode splits this module into slides.
   ```

3. Fenced ` ```sql ` code blocks automatically get Copy and "Run in console"
   buttons in Learn view (the Run button only appears when a SQL playground
   is mounted on the page, i.e. in Learn view, not Present mode).

If a course needs its own practice database, add a schema file under
`public/sql/` and point `SqlConsole` at it (`src/components/playground/sql-console.tsx`
currently hardcodes `/sql/schema.sql` — swap this for a per-course path when a
second course needs a different dataset).

## Project structure

```
src/
  app/
    (site)/            # main site — has its own root layout (Navbar, auth)
      page.tsx          # homepage
      courses/           # course catalog + course/module (Learn) pages
      dashboard/          # progress dashboard (auth-gated by proxy.ts)
      login/, signup/      # auth pages
    present/            # Presentation mode — its OWN root layout (no chrome,
                         # so it can be a true full-screen slide deck)
    api/                # signup, Auth.js handlers, progress tracking
  components/
    mdx/                # MDX renderer + code block (copy/run) + table styling
    playground/         # PGlite-backed SQL console + Learn view split pane
    present/            # slide deck component
  content/courses/      # lesson content (MDX) lives here, not in the DB
  lib/                  # auth config, Prisma client, content loader, slides
prisma/                 # schema + migrations for app data (users, progress)
public/sql/             # schema(s) seeded into the in-browser PGlite database
```

## Deployment

The app is stateless (all persistent data lives in Postgres), reads its
config entirely from environment variables at runtime, and ships as a single
Docker image usable for both serving the app and running migrations — see
`Dockerfile`.

### Building the image

CI builds and publishes the image automatically — see
`.github/workflows/docker-build.yml`. Every push to `main` publishes
`ghcr.io/richard-callis/technical-training:latest` (plus a `sha-<short>` tag);
pushing a `vX.Y.Z` tag also publishes semver-tagged images. Pull requests
build (but don't push) so a broken Dockerfile fails CI before merge.

The first push creates the GHCR package as **private** by default. Either
make it public (package settings on GitHub → "Change visibility") or create
an `imagePullSecret` — see the comment in `k8s/deployment.yaml`.

To build locally instead:

```bash
docker build -t technical-training .
```

### Docker Compose (single host)

```bash
cp .env.example .env   # only AUTH_SECRET is read from here by compose; see below
docker compose up --build
```

This starts Postgres, runs `prisma migrate deploy` once (the `migrate`
service), then starts the app on [http://localhost:3000](http://localhost:3000).
Compose reads `AUTH_SECRET` from your shell environment (falling back to a
dev-only default) — `export AUTH_SECRET="$(openssl rand -base64 32)"` before
`docker compose up` for anything beyond local testing.

### Kubernetes

Manifests live in `k8s/`:

| File | Purpose |
|---|---|
| `secret.example.yaml` | Template for `DATABASE_URL` / `AUTH_SECRET` — see the file for how to create the real Secret |
| `deployment.yaml` | The app, 2 replicas, liveness/readiness probes, non-root |
| `service.yaml` | ClusterIP Service in front of the Deployment |
| `ingress.yaml` | Example nginx + cert-manager Ingress — adjust to your cluster |
| `migrate-job.yaml` | One-off Job that runs `prisma migrate deploy` — apply before/with each release that adds migrations |
| `postgres-dev.yaml` | A single-pod Postgres for dev/eval clusters only — use a managed database in production instead |

Typical first deploy:

```bash
kubectl create secret generic technical-training-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/technical_training?schema=public' \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 32)"

# only if you don't have a database yet:
kubectl apply -f k8s/postgres-dev.yaml

kubectl apply -f k8s/migrate-job.yaml
kubectl wait --for=condition=complete job/technical-training-migrate --timeout=120s

kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/ingress.yaml
```

### Environment variables (runtime, not build-time)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string for app data (users, progress) |
| `AUTH_SECRET` | yes | Auth.js session signing secret — `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | behind a proxy/ingress | Set to `true` so Auth.js trusts `X-Forwarded-*` headers instead of rejecting the request's apparent origin |
| `PORT` | no | Defaults to `3000`; set if your platform requires a different port |
| `ADMIN_EMAILS` | no | Comma-separated list of email addresses that become `ADMIN` on signup, regardless of signup order. The very first account ever created also becomes `ADMIN` automatically (so a fresh deployment always has someone who can assign roles), even without this set. Admins assign STUDENT/INSTRUCTOR/ADMIN roles to other users from `/admin/users` — there's no self-service role picker. |
| `ANTHROPIC_API_KEY` | only for AI training creation | Powers `/admin/create-training` (instructor/admin only): describe a topic, review and edit what Claude drafts, then publish. Everything else in the app works fine without this set — the nav link and page just won't do anything useful. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-sonnet-5`. |

None of these are `NEXT_PUBLIC_`-prefixed, so the same image is safe to
promote across environments (dev/staging/prod) without rebuilding.

### Health checks

- `GET /api/health` — liveness: process is up, no dependency check. A slow
  or unreachable database should fail readiness, not get the pod killed.
- `GET /api/health/ready` — readiness: also confirms the database is
  reachable (`SELECT 1`).

## Notes on the app/(site) vs app/present split

Next.js requires exactly one root layout (`<html>`/`<body>`) per top-level
route tree, but supports **multiple** root layouts via route groups. Present
mode needs to render with zero site chrome (no navbar bleeding through a
full-screen slide deck), so it gets its own root layout at `src/app/present/layout.tsx`
instead of nesting under the site's `(site)/layout.tsx`. If you add new
top-level sections that also need a different shell, follow the same pattern
rather than trying to conditionally hide the Navbar — that's the intended
Next.js mechanism for this ("Multiple root layouts" in the Next.js docs).
