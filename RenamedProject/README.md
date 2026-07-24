# 99 Care Healthcare CRM

React, Supabase, and Node services for 99 Care's public website, private CRM/OS, voice-call intake, WhatsApp automation, HR, billing, and worker assignment workflows.

## Project Structure

```text
src/                 Frontend app source
  admin/             CRM, HR, billing, dashboard, and admin OS screens
  components/        Shared UI and domain components
  pages/             Public website and public workflow pages
  services/          Frontend service-layer operations
  utils/             Phone, CRM, consent, payroll, and intake helpers

public/              Static assets served by Vite
backend/             Express backend for WhatsApp, attendance, OTP, and AI routes
supabase/            Edge functions, migrations, and Supabase config
scripts/             Operational setup/upload scripts for WhatsApp flows and robots.txt
```

## Common Commands

```bash
npm run dev:os       # Private operations portal on port 5173
npm run dev:public   # Public website on port 5174
npm run build        # Type-check and build current mode
npm run build:os     # Build private OS mode
npm run build:public # Build public mode
npm run lint         # Run ESLint
```

The generated build folders (`dist/`, `dist-os/`, `dist-public/`) are intentionally ignored and should not be committed.

## Notes

- Keep secrets in `.env` files only; they are ignored by git.
- WhatsApp Flow JSON files live in `scripts/` because they are operational configuration, not throwaway scratch files.
- Supabase Edge Functions live in `supabase/functions/`; database changes live in `supabase/migrations/`.
