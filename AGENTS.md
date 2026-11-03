<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Wise Cloud Portal — Architecture decisions

- Backend is Lovable Cloud (managed Postgres + Auth + Storage). App-internal logic
  uses `createServerFn` in `src/lib/*.functions.ts`; no Supabase Edge Functions.
- Email + password sign-in only (user decision — no social providers). KYC-created
  accounts are created with `email_confirm: true` because staff verification gates
  real use; the auth-setting global auto-confirm stays off.
- Invitation-only: staff create single-use invitations (`client_invitations`, only a SHA-256 hash of the token is stored); `/register?token=` is the only sign-up path and `registerCustomer` rejects any request without an open, matching invitation.
- Registration is a server function (`registerCustomer`, zod-validated) that
  creates the auth user with the service-role client, re-checks MIME/extension/size
  (10 MB), uploads files under `{user_id}/{uuid}.{ext}` in the private
  `legal-documents` bucket, inserts customer/contact/bank/document rows, and rolls
  back fully (files + auth user) on failure. Client pre-validates and compresses images.
- Roles live only in `public.user_roles`; staff checks go through the
  security-definer `public.is_staff` / `public.has_role` functions. Never store roles elsewhere.
- Customer codes (`ENT-26-00001` / `IND-26-00001`) are assigned by the
  `assign_customer_code` trigger with per-type/per-year counters.
- Bootstrap: `bootstrapSuperuser` (public fn) provisions the first superuser
  (arman@artawise.com) and no-ops once any superuser exists.
- Remember Me: checked = persistent session; unchecked = auto sign-out after 4h
  inactivity (`src/lib/session-pref.ts`).
- Phase plan lives in `roadmap.md`. Phase 2 adds billing/document numbering
  (INV|QUO|FMO|PO|REC-<ENT|IND>/ATT/<year>/<roman month>/<seq>, IDR only, VAT 12% on
  DPP 11%, e-Meterai Rp 10.000 when DPP > Rp 10.000.000).
- Network monitoring: Uptime Kuma is the ping engine; it pushes heartbeats to
  `/api/public/uptime/webhook` (Bearer `UPTIME_KUMA_WEBHOOK_SECRET`). Clients see a
  monitor only via an explicit `monitor_assignments` row (`can_view_monitor` RLS) — never by default.
- UI shell: shared `AppShell` (collapsible sidebar) for all signed-in pages; theme tokens
  in `src/styles.css`, light by default with `.dark` toggle persisted in localStorage.
