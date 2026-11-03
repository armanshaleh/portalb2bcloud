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

## Phase 2 — Billing & documents
- Products & custom private prices with audit logs
- Quotations, invoices, pre-orders (PENDING_APPROVAL workflow, superuser approval tab)
- Document numbering: INV|QUO|FMO|PO|REC-ENT|IND/ATT/<year>/<roman month>/<seq>
- Wet signature & stamp workflow; payment proofs (max 10MB, auto-compress); PPh 23 upload
- Dynamic ticket system with colocation conditional UI (Visit DC, Goods In/Out, E-Pass)
- Announcements; reports & analytics with Excel/CSV export

## Phase 3 — Automation & compliance
- Billing cycles (monthly/quarterly/annual), one-time setup fee, pro-rata calculator
- Lifecycle automation: reminders H-7/H-3, overdue H+1, auto-suspend H+7, auto-terminate H+30
- Coretax DJP: VAT 12% on DPP 11% (11/12 × subtotal), e-Meterai Rp 10.000 when DPP > Rp 10.000.000
- Coretax CSV export; contracts tab with confidential watermark; uptime monitor
