# Wise Cloud Portal — Roadmap

Enterprise Web Portal, Billing System & Data Center Operations platform for
PT Arta Teletama Teknologi ("Wise Cloud — Built with Trust.", document prefix ATT).

## Phase 1 — Auth, KYC, Dashboards (done)
- [x] Lovable Cloud enabled; Phase 1 schema (customers, contacts, bank accounts, legal documents, admin notes, products, services, audit logs, user roles)
- [x] Private `legal-documents` storage bucket with 10 MB limit + RLS
- [x] Login page (/auth): email+password, CAPTCHA, remember me, forgot password
- [x] KYC registration (/register): ENT / IND formats with document uploads
- [x] Forgot-password + reset-password pages
- [x] Role-based dashboards (/backend/dashboard, /user/dashboard)
- [x] Superuser bootstrap (arman@artawise.com)
- [x] End-to-end verification

## Phase 1.5 — Invitations, network monitor, iOS design (done)
- [x] Public sign-up removed; staff invitation links; KYC via invite
- [x] Uptime Kuma webhook receiver + per-customer monitor access + status pages
- [x] iOS-inspired glass design, light default, collapsible sidebar
- [ ] Connect the real Uptime Kuma server (waiting on your Kuma instance + publish)

## Phase 2 — Billing & documents
- [x] Products & custom private prices with audit logs
- [x] Quotations, invoices, POs, FMO, receipts with ATT numbering, PPN/DPP, e-Meterai, superuser approval, client billing page
- [x] Pre-orders (PENDING_APPROVAL workflow, superuser approval tab → auto quotation)
- Document numbering: INV|QUO|FMO|PO|REC-ENT|IND/ATT/<year>/<roman month>/<seq>
- [x] Wet signature & stamp workflow; payment proofs (max 10MB, auto-compress); PPh 23 upload
- [x] Dynamic ticket system with colocation conditional UI (Visit DC, Goods In/Out, E-Pass)
- [x] Announcements (staff publish, client archive) + Notifications bell (auto: verification, monitor assignment, announcements)
- [x] Reports & analytics with Excel export

## Phase 3 — Automation & compliance
- [x] Billing cycles (monthly/quarterly/annual), one-time setup fee, pro-rata calculator
- [x] Lifecycle automation: reminders H-7/H-3, overdue H+1, auto-suspend H+7, auto-terminate H+30
- [x] Coretax DJP: VAT 12% on DPP 11% (11/12 × subtotal), e-Meterai Rp 10.000 when DPP > Rp 10.000.000
- [x] Coretax CSV export; contracts tab with confidential watermark; uptime monitor

## Phase 4 — Ops extras
- [x] Audit log explorer (/backend/audit-logs)
- [ ] App emails (invoice issued, E-Pass, verification) — waiting on sender email domain setup
- [ ] Service inventory: rack / U position / IP / VLAN
- [x] Client self-service PIC contacts
