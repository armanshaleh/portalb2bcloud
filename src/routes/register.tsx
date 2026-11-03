import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  MailCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { registerCustomer } from "@/lib/registration.functions";
import { lookupInvitation } from "@/lib/invitation.functions";
import type { PreparedFile } from "@/lib/upload";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UploadField } from "@/components/upload-field";
import { Captcha } from "@/components/captcha";

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { token?: string | undefined } => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Accept invitation · Wise Cloud Portal" },
      {
        name: "description",
        content:
          "Accept your Wise Cloud invitation from PT Arta Teletama Teknologi: set your password and complete KYC.",
      },
      { property: "og:title", content: "Accept invitation · Wise Cloud Portal" },
      {
        property: "og:description",
        content: "Wise Cloud portal access is by invitation only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  npwpNumber: string;
  nibNumber: string;
  kemenkumhamSk: string;
  directorName: string;
  directorKtpNumber: string;
  fullName: string;
  ktpNumber: string;
  phone: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  billingName: string;
  billingEmail: string;
  billingPhone: string;
  billingPosition: string;
  technicalName: string;
  technicalEmail: string;
  technicalPhone: string;
  technicalPosition: string;
};

const emptyForm: FormState = {
  email: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  npwpNumber: "",
  nibNumber: "",
  kemenkumhamSk: "",
  directorName: "",
  directorKtpNumber: "",
  fullName: "",
  ktpNumber: "",
  phone: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  billingName: "",
  billingEmail: "",
  billingPhone: "",
  billingPosition: "",
  technicalName: "",
  technicalEmail: "",
  technicalPhone: "",
  technicalPosition: "",
};

function RegisterPage() {
  const { token } = Route.useSearch();
  const lookupFn = useServerFn(lookupInvitation);
  const [invite, setInvite] = useState<
    { state: "loading" } | { state: "invalid"; error: string } | { state: "ok"; displayName: string }
  >({ state: "loading" });
  const registerFn = useServerFn(registerCustomer);
  const navigate = useNavigate();
  const [type, setType] = useState<"ENT" | "IND">("ENT");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [docs, setDocs] = useState<Record<string, PreparedFile | null>>({});
  const [captchaOk, setCaptchaOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      setInvite({ state: "invalid", error: "Access to the Wise Cloud portal is by invitation only." });
      return;
    }
    void lookupFn({ data: { token } }).then((res) => {
      if (!res.ok) {
        setInvite({ state: "invalid", error: res.error });
        return;
      }
      setType(res.customerType);
      setForm((f) => ({
        ...f,
        email: res.email,
        companyName: res.customerType === "ENT" ? res.displayName : f.companyName,
        fullName: res.customerType === "IND" ? res.displayName : f.fullName,
      }));
      setInvite({ state: "ok", displayName: res.displayName });
    });
  }, [token, lookupFn]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    const bankOk = form.bankName.trim() && form.bankAccountNumber.trim() && form.bankAccountName.trim();
    if (!bankOk) return "Fill in the complete bank account details.";
    if (type === "ENT") {
      if (!form.companyName.trim() || !form.npwpNumber.trim()) return "Company name and NPWP are required.";
      if (!form.nibNumber.trim() || !form.kemenkumhamSk.trim()) return "NIB and Kemenkumham SK are required.";
      if (!form.directorName.trim() || !form.directorKtpNumber.trim()) return "Director name and KTP number are required.";
      if (!docs["AKTA"]) return "Upload the Akta document.";
      if (!docs["KTP_DIRECTOR"]) return "Upload the Director's KTP.";
      if (!form.billingName.trim() || !form.billingEmail.trim()) return "Billing contact name and email are required.";
      if (!form.technicalName.trim() || !form.technicalEmail.trim()) return "Technical contact name and email are required.";
    } else {
      if (!form.fullName.trim() || !form.ktpNumber.trim()) return "Full name and KTP number are required.";
      if (!docs["KTP"]) return "Upload your KTP.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaOk) {
      toast.error("Please complete the security check.");
      return;
    }
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSubmitting(true);
    const documents = Object.values(docs)
      .filter((d): d is PreparedFile => Boolean(d))
      .map((d) => ({
        docType: d.docType,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        dataBase64: d.dataBase64,
      }));
    const result = await registerFn({
      data: {
        inviteToken: token ?? "",
        customerType: type,
        email: form.email.trim(),
        password: form.password,
        companyName: type === "ENT" ? form.companyName.trim() : null,
        npwpNumber: type === "ENT" ? form.npwpNumber.trim() : null,
        nibNumber: type === "ENT" ? form.nibNumber.trim() : null,
        kemenkumhamSk: type === "ENT" ? form.kemenkumhamSk.trim() : null,
        directorName: type === "ENT" ? form.directorName.trim() : null,
        directorKtpNumber: type === "ENT" ? form.directorKtpNumber.trim() : null,
        fullName: type === "IND" ? form.fullName.trim() : null,
        ktpNumber: type === "IND" ? form.ktpNumber.trim() : null,
        billingContact: {
          name: type === "ENT" ? form.billingName.trim() : form.fullName.trim(),
          email: type === "ENT" ? form.billingEmail.trim() : form.email.trim(),
          phone: (type === "ENT" ? form.billingPhone : form.phone).trim() || null,
          position: type === "ENT" ? form.billingPosition.trim() || null : "Owner",
        },
        technicalContact:
          type === "ENT"
            ? {
                name: form.technicalName.trim(),
                email: form.technicalEmail.trim(),
                phone: form.technicalPhone.trim() || null,
                position: form.technicalPosition.trim() || null,
              }
            : null,
        bankAccount: {
          bankName: form.bankName.trim(),
          accountNumber: form.bankAccountNumber.trim(),
          accountName: form.bankAccountName.trim(),
        },
        documents,
      },
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDone(result.customerCode);
  }

  if (invite.state !== "ok" && !done) {
    return (
      <div className="flex min-h-screen items-center justify-center  px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {invite.state === "loading" ? (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            ) : (
              <MailCheck className="mx-auto h-12 w-12 text-primary" />
            )}
            <CardTitle className="font-display text-xl">
              {invite.state === "loading" ? "Checking your invitation…" : "By invitation only"}
            </CardTitle>
            {invite.state === "invalid" && (
              <CardDescription>
                {invite.error} New accounts are issued by {BRAND.legalName}. Contact our team to
                receive an official invitation link.
              </CardDescription>
            )}
          </CardHeader>
          {invite.state === "invalid" && (
            <CardContent>
              <Button className="w-full" onClick={() => void navigate({ to: "/auth" })}>
                Go to sign in
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center  px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <CardTitle className="font-display text-xl">Registration submitted</CardTitle>
            <CardDescription>
              Your customer ID is <span className="font-semibold text-foreground">{done}</span>.
              The account is now <span className="font-semibold text-warning">PENDING VERIFICATION</span> —
              our team verifies your documents manually. You will be able to use the full portal
              once verification completes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => void navigate({ to: "/auth" })}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-brand flex h-10 w-10 items-center justify-center rounded-xl">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display font-bold text-foreground">{BRAND.name}</p>
            <p className="text-xs text-muted-foreground">{BRAND.tagline}</p>
          </div>
        </div>
        <Link to="/auth" className="text-sm font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>

      <h1 className="font-display text-2xl font-bold">Accept invitation &amp; complete KYC</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All registrations are verified manually by our team before activation.
      </p>

      {/* Entity type (fixed by the invitation) */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border bg-accent p-4">
        {type === "ENT" ? <Building2 className="h-5 w-5 text-primary" /> : <UserRound className="h-5 w-5 text-primary" />}
        <div>
          <p className="font-display font-semibold">
            {type === "ENT" ? "Corporate / PKP (ENT)" : "Individual / Non-PKP (IND)"}
          </p>
          <p className="text-xs text-muted-foreground">
            Invitation for {invite.state === "ok" ? invite.displayName : ""} · account type set by our team
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
        {/* Account credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Account credentials</CardTitle>
            <CardDescription>Your verified email is used for sign-in and official documents.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="email">Verified email</Label>
              <Input id="email" type="email" value={form.email} readOnly disabled required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={set("password")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
            </div>
          </CardContent>
        </Card>

        {/* Identity */}
        {type === "ENT" ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Company & legal data</CardTitle>
              <CardDescription>Company bank account is used for all billing targets.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input id="companyName" value={form.companyName} onChange={set("companyName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npwp">NPWP</Label>
                <Input id="npwp" value={form.npwpNumber} onChange={set("npwpNumber")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nib">NIB</Label>
                <Input id="nib" value={form.nibNumber} onChange={set("nibNumber")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sk">Kemenkumham SK</Label>
                <Input id="sk" value={form.kemenkumhamSk} onChange={set("kemenkumhamSk")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="directorName">Director full name</Label>
                <Input id="directorName" value={form.directorName} onChange={set("directorName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="directorKtp">Director KTP number</Label>
                <Input id="directorKtp" value={form.directorKtpNumber} onChange={set("directorKtpNumber")} required />
              </div>
              <div className="mt-2 space-y-3 sm:col-span-2">
                <Separator />
                <p className="text-sm font-medium">Legal documents</p>
                <UploadField docType="AKTA" label="Akta pendirian" required disabled={submitting} value={docs["AKTA"] ?? null} onChange={(v) => setDocs((d) => ({ ...d, AKTA: v }))} />
                <UploadField docType="KTP_DIRECTOR" label="Director's KTP" required disabled={submitting} value={docs["KTP_DIRECTOR"] ?? null} onChange={(v) => setDocs((d) => ({ ...d, KTP_DIRECTOR: v }))} />
                <UploadField docType="NPWP" label="NPWP document (optional)" disabled={submitting} value={docs["NPWP"] ?? null} onChange={(v) => setDocs((d) => ({ ...d, NPWP: v }))} />
                <UploadField docType="NIB" label="NIB document (optional)" disabled={submitting} value={docs["NIB"] ?? null} onChange={(v) => setDocs((d) => ({ ...d, NIB: v }))} />
                <UploadField docType="SK_KEMENKUMHAM" label="Kemenkumham SK document (optional)" disabled={submitting} value={docs["SK_KEMENKUMHAM"] ?? null} onChange={(v) => setDocs((d) => ({ ...d, SK_KEMENKUMHAM: v }))} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Personal data</CardTitle>
              <CardDescription>Personal bank account is used for all billing targets.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={form.fullName} onChange={set("fullName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ktpNumber">KTP number</Label>
                <Input id="ktpNumber" value={form.ktpNumber} onChange={set("ktpNumber")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={set("phone")} />
              </div>
              <div className="mt-2 space-y-3 sm:col-span-2">
                <Separator />
                <p className="text-sm font-medium">Legal documents</p>
                <UploadField docType="KTP" label="KTP" required disabled={submitting} value={docs["KTP"] ?? null} onChange={(v) => setDocs((d) => ({ ...d, KTP: v }))} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contacts */}
        {type === "ENT" && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Contacts</CardTitle>
              <CardDescription>Billing and technical contacts receive official notifications.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <p className="text-sm font-medium sm:col-span-2">Contact billing</p>
              <div className="space-y-2">
                <Label htmlFor="billingName">Name</Label>
                <Input id="billingName" value={form.billingName} onChange={set("billingName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Email</Label>
                <Input id="billingEmail" type="email" value={form.billingEmail} onChange={set("billingEmail")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingPhone">Phone</Label>
                <Input id="billingPhone" value={form.billingPhone} onChange={set("billingPhone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingPosition">Position</Label>
                <Input id="billingPosition" value={form.billingPosition} onChange={set("billingPosition")} />
              </div>
              <p className="text-sm font-medium sm:col-span-2">Contact technical</p>
              <div className="space-y-2">
                <Label htmlFor="technicalName">Name</Label>
                <Input id="technicalName" value={form.technicalName} onChange={set("technicalName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalEmail">Email</Label>
                <Input id="technicalEmail" type="email" value={form.technicalEmail} onChange={set("technicalEmail")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalPhone">Phone</Label>
                <Input id="technicalPhone" value={form.technicalPhone} onChange={set("technicalPhone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalPosition">Position</Label>
                <Input id="technicalPosition" value={form.technicalPosition} onChange={set("technicalPosition")} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank account */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {type === "ENT" ? "Company bank account" : "Personal bank account"}
            </CardTitle>
            <CardDescription>
              Invoices will target this {type === "ENT" ? "corporate" : "personal"} account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" value={form.bankName} onChange={set("bankName")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountNumber">Account number</Label>
              <Input id="bankAccountNumber" value={form.bankAccountNumber} onChange={set("bankAccountNumber")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountName">Account holder name</Label>
              <Input id="bankAccountName" value={form.bankAccountName} onChange={set("bankAccountName")} required />
            </div>
          </CardContent>
        </Card>

        <Captcha onValidityChange={setCaptchaOk} />

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit registration
        </Button>
        <p className="-mt-4 text-center text-xs text-muted-foreground">
          By submitting you confirm the documents are authentic. All registrations start as
          PENDING VERIFICATION.
        </p>
      </form>
    </div>
  );
}
