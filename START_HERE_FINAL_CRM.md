# Sree Sudha CRM — Consolidated Source Package (29 October 2026)

This folder contains a consolidated Vite/React/TypeScript application, the Supabase SQL migrations and the Supabase Edge Function for secure device-based sign-in. It combines the previously supplied Sree Sudha manager CRM and the agreed hierarchy ID changes. It is **source code**: it is not connected to your Supabase account, cannot automatically migrate your live database and is not a verified live deployment.

## What is included

- Management dashboard; agent directory, nested referral tree, full agent profiles and photos; customer directory and site visits; registration requests and approval; status/archive actions; Excel exports.
- Public registration link `/agent-register`, optional staff/agent referral code, and a confirmation screen. **After successful Supabase submission**, a WhatsApp group invitation appears only if Management has configured one. Pending approval remains separate from group membership.
- Admin/MD: `/agents`, `/management`, `/devices`, `/mirai-sales`, `/daily-work`, `/registration-settings`.
- Employee and agent passkey/device login (Supabase Edge Function), attendance with a server-side 100m radius / five-minute checkout enforcement and agent self-service portal.
- MIRAI plots and bookings; selling agent; customer; live price calculation (square yards × rate), commission estimate, saved numeric snapshots, received payments, outstanding balance, approval/payout flow and reconciliation history. Any uplines' **multi-level incentive payout** remains deliberately excluded because no approved commission split policy was supplied; only the selling agent's commission is calculated.

## Hierarchy Employee IDs (final agreed pattern)

A newly registered direct agent gets a random unused `EMP` plus **four digits**, e.g. `EMP1520`. A direct referral under that person gets two extra digits, e.g. `EMP152001`. A further referral is `EMP15200101`. Another branch under the same original agent could be `EMP152052`. A staff member with root `EMP4827` can also refer an agent `EMP482701`. The suffix increments need not be consecutive: allocation is random among unused suffixes `01..99` to prevent duplicates. IDs remain permanent; re-parenting is blocked by the database. The original agent's old five-digit numeric code is retained internally for historic records but the public login code changes during migration.

Count the two-digit suffixes to get the number of **referral links** above the person. Remove the final two digits to identify their **immediate referrer ID**. If the four-digit root is an office employee, the total number of *agents* above is one fewer than the number of referral links.

## Before any changes to an existing Supabase project

1. **Back up the entire Supabase project/database** and the existing frontend ZIP. Arrange a staging clone of your production Supabase schema and data.
2. Because the hierarchy migration reissues the public agent IDs, decide on a supervised cutover and notify active agents of their new codes. Existing relationships, customers, visits and booking references stay on the underlying UUIDs; existing device accounts are mapped to new public codes.
3. Do not paste all SQL files into an already configured project. Check which migrations your project has already had. Duplicate old migrations may change functions, triggers and RLS unexpectedly. Existing installations: apply only *missing prerequisite migrations*, then the two new `agent_hierarchical_employee_ids.sql` and `crm_whatsapp_registration_invite.sql` **in staging first**.
4. An agent currently signed into the site may need to re-login after the cutover. Device passkeys are origin-scoped: moving between `localhost` and Vercel requires new passkey enrollment for that origin.

## Fresh database: SQL migration dependency order

In **Supabase → SQL Editor**, run one file at a time, only if configuring a new empty project with the required Auth manager profile. Do not run this entire list over an existing live project.

1. `supabase/agent_network_migration.sql`
2. `supabase/staff_attendance_migration.sql`
3. `supabase/staff_employee_registration_migration.sql`
4. `supabase/agent_customers_migration.sql`
5. `supabase/agent_site_visits_migration.sql`
6. `supabase/agent_public_registration_and_random_ids.sql`
7. `supabase/crm_operations_migration.sql`
8. `supabase/agent_team_codes_migration.sql` (legacy source compatibility)
9. `supabase/final_crm_passkey_roles_and_random_staff_ids.sql`
10. `supabase/agent_hierarchical_employee_ids.sql` (**new public ID format**)
11. `supabase/crm_whatsapp_registration_invite.sql` (**new link setting**)

Stop at the first SQL error, inspect the current table, function and policy definitions, and reconcile in staging rather than blindly rerunning migrations. Verify all post-install checks in `supabase/VERIFY_AFTER_INSTALL_READ_ONLY.sql` (zero rows expected for the first three discrepancy queries).

## Configure the frontend (VS Code / Windows)

1. Extract the complete ZIP, open the `sree-sudha-management` folder in VS Code.
2. Create `.env` in the project root by copying `.env.example`. Set your **actual** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the intended staging project. Never place a service-role key in `.env` or browser code.
3. In VS Code **Terminal**, run `npm install`, then `npm run dev`.
4. Open the local URL displayed by Vite, typically `http://localhost:5173`. Use the existing manager account that has `staff_profiles` role `admin` or `md` and is authorized to manage the agent network; manager credentials are **not** included in the ZIP.
5. To publish to Vercel, connect your repository, set the same two `VITE_*` environment variables for Vercel, build with `npm run build`, and configure the correct deployment project. The included `vercel.json` handles client-side routing.

## Deploy passkey login service (mandatory)

The screenshot's “Failed to send a request to the Edge Function” error will persist if this step is skipped. The ZIP cannot auto-deploy a function. Use the Supabase CLI, in a terminal from this project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase secrets set APP_ORIGINS="http://localhost:5173,https://YOUR-STAGING-VERCEL-DOMAIN.vercel.app"
npx supabase functions deploy employee-passkey --no-verify-jwt
```

The Edge Function itself verifies the manager's Supabase access token for privileged actions and requires WebAuthn signature verification for login. The `--no-verify-jwt` deployment option is needed for unauthenticated passkey challenges; **it does not allow Employee ID-only authentication**. Confirm the function shows as deployed, then inspect **Supabase → Edge Functions → employee-passkey → Logs** when a request fails. Make sure `APP_ORIGINS` uses exact website origin values (scheme, hostname and port) with no paths or trailing slashes. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Never expose the latter in Vite or Vercel public environment variables.

**Note:** Browsers require a secure context for passkeys. Local `localhost` and actual HTTPS origins are appropriate; plain HTTP on a LAN IP is not.

## Configure the office and WhatsApp group

- `/management` → Office location: enter the real office latitude/longitude. The system does not guess your office position. Attendance is server-validated within 100 metres, GPS accuracy at most 50 metres, and Check Out after five minutes.
- `/agents` → WhatsApp group settings (or `/registration-settings`): paste the official `https://chat.whatsapp.com/...` URL whenever you obtain it. Until then, successful registration simply displays a confirmation and explains that the group invitation is not configured. Admin/MD can clear or replace the link without changing code.

## Calculation rules and financial controls

- **Plot value:** approved plot area in square yards × approved rate per square yard; final value stored in `mirai_bookings` as numeric snapshot at booking.
- **Selling-agent commission:** saved booking total × MD-approved commission percentage ÷ 100; initially `Calculated`, then MD can `Approve`, then `Mark Paid` only when registered and fully paid.
- **Payments:** each payment is tied to a booking, amount and reference. The database prevents a payment exceeding the remaining balance; payments can be voided only by MD with an explanatory reason.
- **Balance:** booking total − sum of all non-voided payments. The dashboard shows the active-booking outstanding balance and separate historical payments.
- **Cancellation:** a booking with received payments cannot be cancelled without reconciliation. Cancelled booking commissions cannot be approved for payment. Non-reusable IDs and audit logs preserve history.
- **Important:** there is no agreed multi-level / parent-agent commission percentage policy, so this source does *not* automatically distribute commissions to uplines. Configure MD-approved policy before extending payout logic.

## Validation / release checklist

Run `npm test` (financial and ID calculation unit tests) and `npm run build` after installing dependencies. On a **staging** Supabase project, actually test: new direct agent; second-level and third-level agent; existing legacy agent; office-staff referral; registration + MD approval; customer add/edit/archive; site visit create/edit/cancel; agent ID login and activation; permission isolation; GPS attendance; plot booking; duplicate prevention; partial and final payments; cancellation; and MD-only commission approval.

This packaging environment ran the `node --test` unit tests successfully and syntax-parsed the TS/TSX sources, but could **not** install npm dependencies (network/cached packages unavailable), so the full TypeScript project build, SQL migration execution, browser UI tests and live Edge Function deployment remain **unverified**. Do not point the ZIP at production or call it fully production-tested without performing those steps.

## Important file locations

- `src/App.tsx`: routes.
- `src/features/agent-network`: agent hierarchy, customers, site visits.
- `src/features/agent-registration`: public registration, approval, agent portal, group settings.
- `src/features/business/BusinessPage.tsx`: MIRAI plot inventory, bookings, payments, calculations, commissions and exports.
- `src/features/attendance`: staff and agent attendance, management and devices.
- `src/features/auth/pages`: passkey sign-in and activation.
- `src/lib/crmRules.mjs`: unit-testable calculation and hierarchy helpers.
- `supabase/functions/employee-passkey/index.ts`: passkey and trusted-device service.
- `supabase/*.sql`: migrations and read-only verification.
