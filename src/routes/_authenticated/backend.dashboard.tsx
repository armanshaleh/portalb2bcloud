import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  CircleUserRound,
  Clock,
  FileText,
  Landmark,
  Loader2,
  LogOut,
  NotebookPen,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyIdentity } from "@/lib/identity.functions";
import {
  addAdminNote,
  getCustomerDetail,
  listCustomers,
  setCustomerStatus,
  type CustomerRow,
  type StatusAction,
} from "@/lib/staff.functions";
import { BRAND } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { OverviewCharts } from "@/components/overview-charts";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/backend/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const identity = await getMyIdentity();
    if (!identity.isStaff) throw redirect({ to: "/user/dashboard" });
    return { identity };
  },
  component: BackendDashboard,
});

function statusBadge(status: string) {
  switch (status) {
    case "VERIFIED":
      return <Badge variant="success">Verified</Badge>;
    case "PENDING_VERIFICATION":
      return <Badge variant="warning">Pending</Badge>;
    case "SUSPENDED":
      return <Badge variant="danger">Suspended</Badge>;
    case "REJECTED":
      return <Badge variant="secondary">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function BackendDashboard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCustomers);
  const detailFn = useServerFn(getCustomerDetail);
  const statusFn = useServerFn(setCustomerStatus);
  const noteFn = useServerFn(addAdminNote);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listFn(),
  });
  const customers = data?.customers ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const detail = useQuery({
    queryKey: ["customer-detail", selectedId],
    queryFn: () => detailFn({ data: { customerId: selectedId! } }),
    enabled: Boolean(selectedId),
  });

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.customer_code.toLowerCase().includes(q) ||
      (c.company_name ?? "").toLowerCase().includes(q) ||
      (c.full_name ?? "").toLowerCase().includes(q) ||
      c.verified_email.toLowerCase().includes(q)
    );
  });
  const pending = customers.filter((c) => c.status === "PENDING_VERIFICATION");
  const verified = customers.filter((c) => c.status === "VERIFIED");
  const suspended = customers.filter((c) => c.status === "SUSPENDED");

  async function handleStatus(action: StatusAction, note?: string) {
    if (!selectedId) return;
    setActionBusy(true);
    const payload =
      note === undefined
        ? { customerId: selectedId, action }
        : { customerId: selectedId, action, note };
    const res = await statusFn({ data: payload });
    setActionBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Action failed.");
      return;
    }
    toast.success(
      action === "verify"
        ? "Customer verified."
        : action === "reject"
          ? "Registration rejected."
          : action === "suspend"
            ? "Customer suspended."
            : "Customer re-activated.",
    );
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ["customer-detail", selectedId] });
    if (action === "verify" || action === "reject") {
      setSelectedId(null);
      setRejectNote("");
    }
  }

  async function handleAddNote() {
    if (!selectedId || !noteDraft.trim()) return;
    setActionBusy(true);
    const res = await noteFn({ data: { customerId: selectedId, note: noteDraft } });
    setActionBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not save the note.");
      return;
    }
    setNoteDraft("");
    toast.success("Internal note saved.");
    void queryClient.invalidateQueries({ queryKey: ["customer-detail", selectedId] });
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void window.location.assign("/auth");
  }

  const selected = detail.data?.customer ?? null;

  return (
    <AppShell
      variant="staff"
      title="Customers"
      subtitle={BRAND.legalName}
      email={Route.useRouteContext().identity.email}
    >
      <main>
        <div className="space-y-6">
          <OverviewCharts variant="staff" />
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pending verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold text-warning">{pending.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Verified clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold text-success">{verified.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suspended
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold text-destructive">{suspended.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold">{customers.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="queue">
            <TabsList>
              <TabsTrigger value="queue">
                Verification queue
                {pending.length > 0 && (
                  <Badge variant="warning" className="ml-2">{pending.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">All users</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="mt-4 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : pending.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                    <BadgeCheck className="h-8 w-8 text-success" />
                    <p className="text-sm text-muted-foreground">
                      No registrations waiting for verification.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pending.map((c) => <CustomerCard key={c.id} c={c} onOpen={() => setSelectedId(c.id)} />)
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search code, name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="tabular-nums tracking-tight text-xs">{c.customer_code}</TableCell>
                          <TableCell>{c.company_name ?? c.full_name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{c.verified_email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.customer_type}</Badge>
                          </TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                          <TableCell><div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedId(c.id)}>
                              Review
                            </Button>
                            {c.status === "SUSPENDED" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionBusy}
                                onClick={() => void handleStatus("reactivate")}
                              >
                                Unsuspend
                              </Button>
                            ) : c.status === "VERIFIED" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                disabled={actionBusy}
                                onClick={() => void handleStatus("suspend")}
                              >
                                Suspend
                              </Button>
                            ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            No customers found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </main>

      {/* Detail dialog */}
      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selected
                ? `${selected.customer_code} · ${selected.company_name ?? selected.full_name ?? ""}`
                : "Loading…"}
            </DialogTitle>
            <DialogDescription>
              {selected && <span className="flex items-center gap-2">{selected.verified_email}</span>}
            </DialogDescription>
          </DialogHeader>

          {detail.isLoading || !detail.data ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Verification status</span>
                {statusBadge(detail.data.customer.status)}
              </div>
              <section>
                <p className="mb-2 font-medium">Identity</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  <span>Type</span>
                  <span>{detail.data.customer.customer_type}</span>
                  {detail.data.customer.customer_type === "ENT" ? (
                    <>
                      <span>NPWP</span>
                      <span>{detail.data.customer.npwp_number ?? "—"}</span>
                      <span>NIB</span>
                      <span>{detail.data.customer.nib_number ?? "—"}</span>
                      <span>Kemenkumham SK</span>
                      <span>{detail.data.customer.kemenkumham_sk ?? "—"}</span>
                      <span>Director</span>
                      <span>{detail.data.customer.director_name ?? "—"}</span>
                      <span>Director KTP</span>
                      <span>{detail.data.customer.director_ktp_number ?? "—"}</span>
                    </>
                  ) : (
                    <>
                      <span>Full name</span>
                      <span>{detail.data.customer.full_name ?? "—"}</span>
                      <span>KTP</span>
                      <span>{detail.data.customer.ktp_number ?? "—"}</span>
                    </>
                  )}
                  <span>Registered</span>
                  <span>{formatDateTime(detail.data.customer.created_at)}</span>
                </div>
              </section>

              <Separator />

              <section>
                <p className="mb-2 font-medium">Documents</p>
                <div className="space-y-2">
                  {detail.data.documents.map((doc) => {
                    const url = detail.data?.documentUrls[doc.id];
                    return (
                      <div key={doc.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{doc.doc_type.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">({doc.original_name})</span>
                        </span>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                  {detail.data.documents.length === 0 && (
                    <p className="text-muted-foreground">No documents uploaded.</p>
                  )}
                </div>
              </section>

              <section>
                <p className="mb-2 font-medium">Contacts</p>
                <div className="space-y-1">
                  {detail.data.contacts.map((ct) => (
                    <div key={ct.id} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-muted-foreground">
                      <Badge variant="outline" className="w-full justify-center text-[10px]">{ct.contact_type}</Badge>
                      <span className="truncate">{ct.name} · {ct.position ?? "—"}</span>
                      <span className="text-right">{ct.email}{ct.phone ? ` · ${ct.phone}` : ""}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 flex items-center gap-2 font-medium">
                  <Landmark className="h-4 w-4" /> Bank accounts
                </p>
                {detail.data.bankAccounts.map((b) => (
                  <p key={b.id} className="text-muted-foreground">
                    {b.account_type} · {b.bank_name} · {b.account_number} ({b.account_name})
                  </p>
                ))}
              </section>

              <Separator />

              {/* Verification actions */}
              {selected && selected.status === "PENDING_VERIFICATION" && (
                <section className="space-y-3 rounded-lg border border-border p-3">
                  <p className="font-medium">Verification decision</p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={actionBusy}
                      onClick={() => void handleStatus("verify")}
                    >
                      <BadgeCheck className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={actionBusy || !rejectNote.trim()}
                      onClick={() => void handleStatus("reject", rejectNote)}
                    >
                      Reject
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Revision notes (required for rejection)"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                </section>
              )}
              {selected && selected.status === "VERIFIED" && (
                <Button
                  variant="outline"
                  className="w-full text-destructive"
                  disabled={actionBusy}
                  onClick={() => void handleStatus("suspend")}
                >
                  Suspend user
                </Button>
              )}
              {selected && selected.status === "SUSPENDED" && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={actionBusy}
                  onClick={() => void handleStatus("reactivate")}
                >
                  Re-activate user
                </Button>
              )}
              {selected && selected.status === "REJECTED" && selected.rejection_reason && (
                <p className="rounded-md border border-border p-3 text-muted-foreground">
                  Rejection reason: {selected.rejection_reason}
                </p>
              )}

              <Separator />

              <section>
                <p className="mb-2 flex items-center gap-2 font-medium">
                  <NotebookPen className="h-4 w-4" /> Internal notes (hidden from clients)
                </p>
                <div className="space-y-2">
                  {detail.data.notes.map((n) => (
                    <div key={n.id} className="rounded-md border border-border p-2 text-muted-foreground">
                      <p>{n.note}</p>
                      <p className="mt-1 text-xs">
                        {n.author_email ?? "system"} · {formatDateTime(n.created_at)}
                      </p>
                    </div>
                  ))}
                  {detail.data.notes.length === 0 && (
                    <p className="text-muted-foreground">No notes yet.</p>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Add an internal note…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <Button size="sm" disabled={actionBusy || !noteDraft.trim()} onClick={() => void handleAddNote()}>
                    Save
                  </Button>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CustomerCard({ c, onOpen }: { c: CustomerRow; onOpen: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <CircleUserRound className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {c.company_name ?? c.full_name ?? c.verified_email}{" "}
              <span className="ml-1 tabular-nums tracking-tight text-xs text-muted-foreground">{c.customer_code}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {c.customer_type} · {c.verified_email} · {formatDateTime(c.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(c.status)}
          <Button size="sm" onClick={onOpen}>
            Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
