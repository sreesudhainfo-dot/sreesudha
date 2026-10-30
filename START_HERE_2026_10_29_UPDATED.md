# Sree Sudha CRM — Updated consolidated project

This package is an updated React/Vite CRM source, **not a live-tested production deployment**. It retains the existing management, agent network, customer, site visit, MIRAI inventory, booking, payment, commission and attendance code. All migrations must be tested on a database backup or staging project before changing real records.

## What changed

1. **Employee ID-only staff and agent access**: `/staff-login` and `/agent-login` now look up active Employee IDs in Supabase directly. A successful code lookup opens only the dedicated attendance/activity portal. It does not open management, customer directories, plot bookings, payment entry, or commissions. Management still signs in securely at `/login`.
2. **Attendance**: the **GPS-accuracy cutoff is removed**. The 100-metre office boundary and five-minute minimum between Check In and Check Out remain. GPS position is still required. New code-only attendance uses a dedicated `id_portal_attendance` ledger and appears separately in management reports. Legacy attendance data stays intact.
3. **MIRAI deletion**: deleted/archived plots disappear from live inventory. Cancelled bookings and commissions, and voided payments, are excluded from the corresponding active tables. The underlying financial/audit histories are retained and are not hard-deleted. Existing receipt totals intentionally include historically received non-voided payments even from later-cancelled bookings; refunds require a separate documented workflow.
4. **Professional wording**: removed unnecessary "MD says"/"MD-approved" language from active screens. Finance-only controls remain protected by privileged management roles.
5. **Employee directory**: new `/employees` management page assigns an `EMP` plus four-digit code automatically; active staff can use `/staff-login` without enrolling passkeys.
6. **Referrals**: root `EMP1520`, then child `EMP152001`, then `EMP15200101`. Agents may be referred by an agent or a newly registered office employee. IDs are permanent and two-digit suffixes support up to 99 direct referrals per person.
7. **Agent intake/WhatsApp**: registration success can display the configurable WhatsApp group invitation; leave the setting blank until you have a real invitation link.

## Critical security limitation of ID-only access

**An Employee ID is NOT authentication.** Any person who learns or guesses a valid Employee ID can impersonate that staff member or agent, record false attendance, and potentially view their basic attendance or work/visit summaries. Browser GPS readings can also be spoofed. This portal implements your specific ID-only request but is **not an appropriate secure production authentication design**. For real sensitive data, payroll and audit-grade attendance, restore passkeys, PINs or another secure identity check. RLS is NOT disabled, and management/customer/payment tables are not opened to anonymous requests by this change.

## Installation — existing project

1. **Back up your existing Supabase database and Storage files. Test in a separate staging project first.** Do not overwrite existing project or database without a backup.
2. Extract this ZIP into a new folder (do not mix old ZIP files). Open `sree-sudha-management` in VS Code.
3. Configure a `.env` file from `.env.example` with **the correct Supabase URL and public anon/publishable key**. Never put a service role key in the frontend.
4. Check that the earlier CRM tables and hierarchy migration are installed. This add-on depends on `agent_network`, `agent_hierarchy_id_reservations`, `agent_registration_requests`, `staff_profiles`, `staff_attendance`, `office_settings`, `employee_daily_work`, `agent_site_visits`, and MIRAI business tables.
5. In the **staging Supabase SQL Editor**, run exactly `supabase/20261029_id_only_portals.sql` **once after the older CRM migrations**. This is a non-destructive add-on for ID-only portals, the legacy GPS-accuracy fix and employee code referral compatibility. It creates three additional tables (`id_portal_staff`, `id_portal_attendance`, `id_portal_work`) and database functions. Review function permissions carefully; several functions are intentionally callable by anonymous visitors because of the ID-only requirement. The migration also restores restricted management-only agent photo upload policies, without opening the private bucket to everyone.
6. In VS Code terminal at the project root run `npm install`, `npm run build`, and `npm run dev`. Open `http://localhost:5173`.
7. Log into **Management** at `/login` with a management Supabase account. Open `/employees` and register a test employee. Test `/staff-login` with the issued Employee ID, then test attendance and work entry.
8. Register a test direct agent under management. Test `/agent-login` and a second-level referral. Check the referral IDs in the database.
9. Add one fictional MIRAI plot; archive it and verify it no longer appears in active inventory. Test a sample booking, payment and commission calculation before importing financial data.
10. Only after successful end-to-end staging tests should you install the same migration and deploy the site for real users.

**No Edge Function is required for the new ID-only login.** The old `employee-passkey` function remains in the repository for historical compatibility, but its enrollment pages are no longer part of the primary application navigation.

## If something fails

- Registration photo upload `400`/RLS error: this is a separate Supabase Storage permission issue in `agent-photos`. Check the failed request's **Response**, and verify `agent_photo_insert` and management permissions. Do not disable RLS.
- Management "Operation failed": inspect the failed request in the Chrome Network tab and verify that the CRM operations migration and current management policies are installed.
- ID-only login says function missing: install `20261029_id_only_portals.sql` on the **same Supabase project** pointed to by `.env`.
- Archived plot still visible: hard-refresh the new frontend and verify `is_active=false` on that plot; the refreshed live inventory hides it.
- Staff attendance history initially empty: the new code-only portal stores records in `id_portal_attendance` and does not rewrite historical authenticated records in `staff_attendance`. Management can review both ledgers.
- Financial entries remain immutable for audit; cancelled transactions are filtered from the active list rather than deleted from the database.

## Validation performed on this package

- TypeScript/TSX syntax parsing: passed.
- `node --test tests/*.test.mjs`: four calculation / hierarchy tests passed.
- Full `npm run build`: **not available** in the construction environment because dependency downloads were unavailable. Run this on your laptop.
- SQL migration, live Supabase RLS, actual browser workflows, and complete Vercel deployment: **not live-tested**. Do not consider this production-certified.
