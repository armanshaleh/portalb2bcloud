import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getFileUrl, uploadBillingAttachment } from "@/lib/portal.functions";
import { formatDateTime, formatFileSize } from "@/lib/format";
import type { PreparedFile } from "@/lib/upload";
import { UploadField } from "@/components/upload-field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const KIND_LABEL = {
  PROOF_OF_TRANSFER: "Proof of transfer",
  PPH23_CERTIFICATE: "PPh 23 certificate",
  SIGNED_DOCUMENT: "Signed & stamped scan",
} as const;
type Kind = keyof typeof KIND_LABEL;

export function BillingAttachments({ documentId, canUpload }: { documentId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadBillingAttachment);
  const fileFn = useServerFn(getFileUrl);
  const [kind, setKind] = useState<Kind>("PROOF_OF_TRANSFER");
  const [file, setFile] = useState<PreparedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["billing-attachments", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_attachments")
        .select("id,kind,storage_path,original_name,file_size,created_at")
        .eq("document_id", documentId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      await uploadFn({
        data: { documentId, kind, file: { originalName: file.originalName, mimeType: file.mimeType as "application/pdf", size: file.size, dataBase64: file.dataBase64 } },
      });
      toast.success("Uploaded. Our finance team will verify it.");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["billing-attachments", documentId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function open(path: string) {
    try {
      const { url } = await fileFn({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("File not available.");
    }
  }

  return (
    <div className="space-y-3 border-t pt-4 print:hidden">
      <p className="text-sm font-semibold">Attachments</p>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        data.map((a) => (
          <button key={a.id} type="button" onClick={() => void open(a.storage_path)} className="flex w-full items-center gap-2 text-left text-sm hover:text-primary">
            <FileText className="h-4 w-4 text-primary" />
            <span className="truncate">{KIND_LABEL[a.kind as Kind]} · {a.original_name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatFileSize(a.file_size)} · {formatDateTime(a.created_at)}</span>
          </button>
        ))
      )}
      {canUpload && (
        <div className="space-y-2 rounded-2xl border p-3">
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <UploadField docType={kind} label="File" value={file} onChange={setFile} disabled={busy} />
          <Button size="sm" disabled={!file || busy} onClick={() => void upload()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
        </div>
      )}
    </div>
  );
}
