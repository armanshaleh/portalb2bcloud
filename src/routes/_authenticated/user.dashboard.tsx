import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CircleAlert,
  Clock,
  CheckCircle2,
  FileText,
  Landmark,
  LogOut,
  Server,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import { getMyCustomerOverview } from "@/lib/client.functions";
import { BRAND } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { OverviewCharts } from "@/components/overview-charts";
import { ContactsEditor } from "@/components/contacts-editor";
import { formatDate, formatFileSize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/user/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (identity.isStaff) throw redirect({ to: "/backend/dashboard" });
    return { identity };
  },
  loader: () => getMyCustomerOverview(),
  component: UserDashboard,
});

function statusBadge(status: string) {
  switch (status) {
    case "VERIFIED":
      return <Badge variant="success">Verified</Badge>;
    case "PENDING_VERIFICATION":
      return <Badge variant="warning">Pending verification</Badge>;
    case "SUSPENDED":
      return <Badge variant="danger">Suspended</Badge>;
    case "REJECTED":
      return <Badge variant="secondary">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function UserDashboard() {
  const queryClient = useQueryClient();
  const overview = Route.useLoaderData();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void window.location.assign("/auth");
  }

  async function viewDocument(storagePath: string) {
    const { data } = await supabase.storage
      .from("legal-documents")
      .createSignedUrl(storagePath, 600);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  }


  const customer = overview.customer;

  return (
    <AppShell
      variant="client"
      title="Overview"
      subtitle={customer ? `${customer.customer_code} · ${BRAND.name}` : BRAND.name}
      email={customer?.verified_email}
    >
      <main className="mx-auto max-w-6xl space-y-6">
        {!customer ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CircleAlert className="h-8 w-8 text-warning" />
              <p className="font-medium">No customer profile is linked to this account.</p>
              <p className="max-w-md text-sm text-muted-foreground">
                If you just registered, wait a moment and refresh. If this is your first time,
                complete the company registration first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {customer.status === "VERIFIED" && (
              <div className="glass flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <p className="text-sm">
                  <span className="font-medium text-success">Account verified &amp; active</span>
                  <span className="text-muted-foreground"> · Customer ID <span className="tabular-nums font-medium text-foreground">{customer.customer_code}</span> · Full portal access granted.</span>
                </p>
              </div>
            )}
            {customer.status === "VERIFIED" && <OverviewCharts variant="client" />}
            {/* Status banner */}
            {customer.status === "PENDING_VERIFICATION" && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="flex items-start gap-3 p-4">
                  <Clock className="mt-0.5 h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">Your account is under verification</p>
                    <p className="text-sm text-muted-foreground">
                      Customer ID {customer.customer_code} — our team verifies your documents
                      manually. This usually takes 1 business day. You will get full portal
                      access once verification completes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {customer.status === "REJECTED" && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="flex items-start gap-3 p-4">
                  <CircleAlert className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Registration rejected</p>
                    <p className="text-sm text-muted-foreground">
                      Reason: {customer.rejection_reason ?? "—"} · Customer ID{" "}
                      {customer.customer_code}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {customer.status === "SUSPENDED" && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="flex items-start gap-3 p-4">
                  <CircleAlert className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Account suspended</p>
                    <p className="text-sm text-muted-foreground">
                      Services are paused and overdue invoices block re-activation. Raise a
                      re-activation ticket from Support tickets or contact {BRAND.name} support.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Identity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between font-display text-lg">
                    {customer.customer_type === "ENT" ? "Company profile" : "Personal profile"}
                    {statusBadge(customer.status)}
                  </CardTitle>
                  <CardDescription>Customer ID {customer.customer_code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1.5 text-sm">
                    {customer.customer_type === "ENT" ? (
                      <>
                        <span className="text-muted-foreground">Company</span>
                        <span>{customer.company_name}</span>
                        <span className="text-muted-foreground">NPWP</span>
                        <span>{customer.npwp_number ?? "—"}</span>
                        <span className="text-muted-foreground">NIB</span>
                        <span>{customer.nib_number ?? "—"}</span>
                        <span className="text-muted-foreground">Kemenkumham SK</span>
                        <span>{customer.kemenkumham_sk ?? "—"}</span>
                        <span className="text-muted-foreground">Director</span>
                        <span>{customer.director_name ?? "—"}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Full name</span>
                        <span>{customer.full_name}</span>
                        <span className="text-muted-foreground">KTP</span>
                        <span>{customer.ktp_number ?? "—"}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Registered</span>
                    <span>{formatDate(customer.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Contacts + bank */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="font-display text-lg">Contacts</CardTitle>
                    {customer && customer.customer_type === "ENT" && (
                      <ContactsEditor customerId={customer.id} contacts={overview.contacts} onSaved={() => void router.invalidate()} />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {overview.contacts.map((ct) => (
                      <div key={ct.id} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
                        <Badge variant="outline" className="w-full justify-center text-[10px]">
                          {ct.contact_type}
                        </Badge>
                        <span className="truncate">{ct.name}</span>
                        <span className="text-right text-muted-foreground">{ct.email}</span>
                      </div>
                    ))}
                    {overview.contacts.length === 0 && (
                      <p className="text-muted-foreground">No contacts recorded.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-lg">
                      <Landmark className="h-4 w-4" /> Billing bank account
                    </CardTitle>
                    <CardDescription>
                      {overview.bankAccounts[0]?.account_type === "CORPORATE"
                        ? "Corporate account — invoices target this account."
                        : "Personal account — invoices target this account."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {overview.bankAccounts.map((b) => (
                      <p key={b.id}>
                        {b.bank_name} · {b.account_number} · {b.account_name}
                      </p>
                    ))}
                    {overview.bankAccounts.length === 0 && <p>No bank account recorded.</p>}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Verification documents</CardTitle>
                <CardDescription>Files you submitted during registration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="shrink-0">{doc.doc_type.replace(/_/g, " ")}</span>
                      <span className="truncate text-muted-foreground">({doc.original_name})</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)}
                      </span>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void viewDocument(doc.storage_path)}>
                      View
                    </Button>
                  </div>
                ))}
                {overview.documents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No documents on file.</p>
                )}
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Server className="h-4 w-4" /> My services
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.services.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No services yet. Once your account is verified, our sales team will
                    provision your colocation, dedicated internet or cloud services here.
                  </p>
                ) : (
                  <div className="space-y-2 text-sm">
                    {overview.services.map((s) => (
                      <div key={s.id} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3">
                        <span className="tabular-nums tracking-tight text-xs text-muted-foreground">{s.service_code}</span>
                        <span className="truncate">{s.service_name}</span>
                        <Badge variant="outline" className="justify-self-end">{s.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </AppShell>
  );
}
