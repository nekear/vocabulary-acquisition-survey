# Security Policy

## Supported versions

Security fixes are applied to the default branch used for the live survey website. Older tags are not maintained unless noted in a release.

## Reporting a vulnerability

If you believe you have found a security issue in this repository or the
deployed submission service, please report it responsibly:

- **Email:** [hi@nekear.me](mailto:hi@nekear.me)
- **Subject:** include `SECURITY` and a short summary

Please do not open public GitHub issues for undisclosed vulnerabilities.

Include, when possible:
- A description of the issue and impact
- Steps to reproduce
- Affected routes or components (e.g. `/api/submissions/init`)
- Any proof-of-concept or suggested fix

I aim to acknowledge reports within a few business days. I will work with you
on verification and remediation before any public disclosure you plan to make.

## Scope

In scope:
- This web application (Next.js app, API routes, client submission flow)
- Supabase integration as configured in this repo (migrations, storage bucket)
- Privacy and data-handling behavior described in [content/overview.md](content/overview.md)

Out of scope:

- Anki desktop/mobile applications
- Supabase platform vulnerabilities (report to [Supabase](https://supabase.com/security))
- Vercel platform vulnerabilities (report to [Vercel](https://vercel.com/security))
- Social engineering of study participants

## Security model (summary)

For a full trust-boundary description, see the **Security model** section in
[README.md](README.md).

- Raw `.apkg` files and media are parsed **only in the browser**, and are not
  uploaded to the application server;
- The server receives submission **metadata** at init, then a **gzipped JSON**
  object uploaded directly to private Supabase Storage via a signed URL;
- Withdrawal tokens are stored as **SHA-256 hashes**. Plaintext tokens are
  returned once to the participant on first submission;
- API routes use the Supabase **service role** server-side. Table RLS does not
  limit the application process.

Thank you for helping keep participant data safe.
