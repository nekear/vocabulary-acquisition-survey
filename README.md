# Personalized Vocabulary Acquisition Research Survey

This repository contains the web application used to collect Anki `.apkg`
submissions for a Master's research project on personalized vocabulary
complexity.

The app parses a learner's Anki export locally in the browser, lets
contributors inspect and exclude sensitive content before anything leaves their
device, and then uploads a minimized JSON payload for research use. The public
participant-facing overview that explains the data-handling policy lives in
[content/overview.md](content/overview.md).

Licensed under [MIT](LICENSE). Security reports: [SECURITY.md](SECURITY.md).
Environment template: [`.env.example`](.env.example).

## What this project does

The `/research` flow is a guided submission wizard that:
1. collects a language-learning profile and optionally links it to a prior submission via a withdrawal token;
2. parses one or more Anki `.apkg` files entirely in the browser with `sql.js` and `JSZip`;
3. reconstructs deck, note, card, and review-log data into a normalized client model;
4. lets the contributor review note content, remove notes, and filter tags before submission;
5. builds a gzipped JSON payload and uploads it to Supabase Storage using a signed upload URL;
6. supports later withdrawal of all submissions linked to the same token via `/research/withdraw`

## Reviewing the codebase

If you are reviewing the codebase, the most important places to start are:
- The steps of the survey themselves:
  1. #1 The "Profile" step: [app/research/_components/Step1Profile.tsx](app/research/_components/Step1Profile.tsx);
  2. #2 The "Upload" step: [app/research/_components/Step2Upload.tsx](app/research/_components/Step2Upload.tsx);
  3. #3 The "Configure" step: [app/research/_components/Step3DeckConfiguration.tsx](app/research/_components/Step3DeckConfiguration.tsx);
  4. The review and submission step: [app/research/_components/StepDoneSubmit.tsx](app/research/_components/StepDoneSubmit.tsx);

- The key logic behind the survey:
  - [app/research/_components/ResearchSubmissionWizard.tsx](app/research/_components/ResearchSubmissionWizard.tsx):
    orchestration of the multi-step participant flow
  - [lib/hooks/useApkgParser.ts](lib/hooks/useApkgParser.ts): browser-side `.apkg`
    parsing and normalization
  - [lib/hooks/usePiiScanner.ts](lib/hooks/usePiiScanner.ts): local heuristics for
    flagging potentially sensitive note content
  - [lib/buildSubmissionPayload.ts](lib/buildSubmissionPayload.ts): conversion from
    reviewed client state into the final research payload
  - [lib/research.ts](lib/research.ts): shared indexing, privacy-review helpers,
    payload assembly helpers, and derived submission stats
  - [app/api/submissions/init/route.ts](app/api/submissions/init/route.ts),
    [app/api/submissions/[id]/confirm/route.ts](app/api/submissions/%5Bid%5D/confirm/route.ts),
    [app/api/submissions/link/route.ts](app/api/submissions/link/route.ts), and
    [app/api/submissions/withdraw/route.ts](app/api/submissions/withdraw/route.ts):
    signed-upload initialization, submission confirmation, token linking, and
    withdrawal
  - [content/overview.md](content/overview.md): participant-facing explanation of
    data collection, exclusions, transformations, and release policy

If you're here just to understand what is being sent to the server, take a look at:
- [lib/hooks/useApkgParser.ts](lib/hooks/useApkgParser.ts)
- [lib/buildSubmissionPayload.ts](lib/buildSubmissionPayload.ts)
- [app/api/submissions/init/route.ts](app/api/submissions/init/route.ts),
  [app/api/submissions/[id]/confirm/route.ts](app/api/submissions/%5Bid%5D/confirm/route.ts),
  [app/api/submissions/link/route.ts](app/api/submissions/link/route.ts)

## Stack
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS and shadcn/ui
- `sql.js` for browser-side SQLite access
- `JSZip` for `.apkg` archive handling
- Supabase Postgres + Storage for submission state and payload storage
- Zustand for persisted client-side wizard state

## High-level architecture

### Client

- `/research` is a multi-step flow implemented as a stateful client wizard;
- Uploaded `.apkg` files are parsed locally;
- Notes, tags, and decks are normalized into a shared submission index;
- Privacy review happens in-memory in the browser before payload generation;
- The final payload preview can be downloaded locally before submission;

### Server
- `POST /api/submissions/init` validates metadata, creates a pending row, and
  returns a signed upload URL;
- The client uploads the gzipped JSON payload directly to Supabase Storage;
- `POST /api/submissions/[id]/confirm` marks a successful upload as finalized;
- `POST /api/submissions/link` resolves a prior withdrawal token to reuse the
  participant profile;
- `POST /api/submissions/withdraw` withdraws all submissions tied to a token.

### Storage

- Submission metadata is stored in the `submitters` and `submissions` tables;
- Uploaded payloads are stored as `.json.gz` objects in a private Supabase
  bucket;
- The current schema migration is
  [supabase/migrations/0001_initial.sql](supabase/migrations/0001_initial.sql);
- The payload is uploaded directly to Supabase to bypass the Vercel request size limit.

## Repository guide
- [app](app): routes, submission UI, and API handlers;
- [components](components): shared UI components;
- [content](content): participant-facing markdown content;
- [lib](lib): parsing, validation, payload building, storage helpers, and shared types;
- [supabase](supabase): local Supabase config and migrations.

Primary routes:
- `/` redirects to `/research`;
- `/research` is the submission wizard;
- `/research/overview` renders the participant-facing overview markdown;
- `/research/withdraw` handles token-based withdrawal.

## Security model

This section summarizes trust boundaries for auditors. Participant-facing policy
detail is in [content/overview.md](content/overview.md) (including fields
collected, excluded, and transformed **after** upload but before public release).

### What stays on the participant device

- Raw `.apkg` archives (ZIP + SQLite + media) are read only in the browser via
  [`lib/hooks/useApkgParser.ts`](lib/hooks/useApkgParser.ts).
- Note-level include/exclude, tag filtering, and PII heuristics run locally
  ([`lib/hooks/usePiiScanner.ts`](lib/hooks/usePiiScanner.ts)).
- The exact JSON to be uploaded can be downloaded before submit
  ([`app/research/_components/StepDoneSubmit.tsx`](app/research/_components/StepDoneSubmit.tsx)).

### What is sent to the server

| Data | When | Where |
|------|------|--------|
| Gzipped research JSON (reviewed subset) | After local build | Private Supabase Storage bucket `submissions` |
| Language profile, consent flags, schema version | `POST /api/submissions/init` | `submissions` row + linked `submitters` row |
| Truncated `User-Agent` (max 255 chars) | Init | `submissions.client_user_agent` |
| Withdrawal token (plaintext) | Once, on first init without a prior token | HTTPS response to browser only |
| Withdrawal token (hash) | Init / link / withdraw | `submitters.withdrawal_token_hash` |

**Not uploaded:** the `.apkg` file, Anki media files, or the full SQLite database.

### Server-side behavior worth auditing

- API routes use [`lib/supabase.ts`](lib/supabase.ts) with `SUPABASE_SERVICE_ROLE_KEY`
  (bypasses Postgres RLS; access control is application logic + storage policies);
- [`lib/server/origin.ts`](lib/server/origin.ts) checks `ALLOWED_ORIGINS` when an
  `Origin` header is present. Requests **without** `Origin` are allowed;
- Init stores metadata from the request body. The uploaded object is not parsed
  server-side. Compare init consent fields with the gzipped JSON if auditing
  consistency;
- Timestamp offsets and synthetic ID remapping are **not** applied in this app;
  see [content/overview.md](content/overview.md) for the post-submission release
  pipeline.

### Other client-side persistence and telemetry

- **Wizard draft:** Zustand persists in-progress state to `localStorage` under
  `research-submission-draft-v1` ([`lib/hooks/useSubmissionStore.ts`](lib/hooks/useSubmissionStore.ts)),
  which can include parsed deck/note data until cleared or submitted.
- **Analytics:** In production, [`@vercel/analytics`](https://www.npmjs.com/package/@vercel/analytics)
  may send page-view style events to Vercel ([`app/layout.tsx`](app/layout.tsx));
  this is separate from submission payloads. Survey profile data, deck content,
  and submission payloads are not intentionally sent through analytics.

To report vulnerabilities, see [SECURITY.md](SECURITY.md).

## Local setup and verification

### Requirements

- Node.js 20+
- [npm](https://docs.npmjs.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for database and storage)

### Environment

```bash
cp .env.example .env.local
```

Fill in Supabase credentials and adjust origins for your dev URL. See
[`.env.example`](.env.example) for every variable and whether it is server-only
or public.

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret / server only** | API + storage access |
| `NEXT_PUBLIC_INFO_URL` | Public (client bundle) | Data-handling / overview links |
| `ALLOWED_ORIGINS` | Server | Extra allowed `Origin` values for API routes |
| `SUBMISSION_MAX_BYTES` | Server | Max gzipped upload size at init |
| `WITHDRAWAL_TOKEN_BYTES` | Server | Entropy for new withdrawal tokens |

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/research`.

### Supabase (first time)

```bash
supabase init   # if not already initialized
supabase link --project-ref <your-project-ref>
supabase db push
```

Ensure a private `submissions` storage bucket exists (see
[`supabase/config.toml`](supabase/config.toml) and
[`supabase/migrations/0001_initial.sql`](supabase/migrations/0001_initial.sql)):
max size 100 MiB, MIME type `application/json`, signed uploads via service role.

### Checks before you trust a deployment

```bash
npm run lint
npm run build
```

Manual smoke tests:

1. Parse a small `.apkg` on step 2 - confirm no network upload until submit;
2. Download the review JSON on step 4 - confirm it matches what you expect to upload;
3. Complete a submission - confirm a `pending` then `uploaded` row and a `.json.gz` object in storage;
4. Withdraw with the issued token - confirm linked rows move to `withdrawn`.

## License

[MIT](LICENSE)
