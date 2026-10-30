# Sree Sudha CRM — Consolidated Codebase

**Start with [`START_HERE_FINAL_CRM.md`](START_HERE_FINAL_CRM.md).**

This is the consolidated React/Vite + Supabase project. It contains management, agents, referral hierarchy, customers, site visits, registration approval, attendance, device passkeys, daily work, MIRAI plots/bookings/payments/commission calculations and a configurable WhatsApp group link.

For local development: create `.env` from `.env.example`, then run `npm install`, `npm test`, `npm run build`, `npm run dev`. The Supabase migrations and Edge Function must be installed/configured separately on a **staging** project before any production rollout.

**Not a tested live deployment.** See the guide for production prerequisites, ID migration risks and the financial-calculation scope.
