import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { getFileUrl } from "@/lib/portal.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ContractRow = {
  id: string;
  title: string;
  contract_type: string;
  file_path: string;
  mime_type: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

/** Confidential viewer: file loaded as a blob, tiled watermark with viewer identity on top, no download control. */
export function ContractViewer({ contract, viewer, onClose }: { contract: ContractRow | null; viewer: string; onClose: () => void }) {
  const fileFn = useServerFn(getFileUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!contract) return;
    let blobUrl: string | null = null;
    setUrl(null);
    setErr(false);
    (async () => {
      try {
        const { url: signed } = await fileFn({ data: { path: contract.file_path } });
        const blob = await (await fetch(signed)).blob();
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } catch {
        setErr(true);
      }
    })();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [contract, fileFn]);

  const stamp = `CONFIDENTIAL · PT ARTA TELETAMA TEKNOLOGI · ${viewer} · ${new Date().toLocaleString("id-ID")}`;

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl" onContextMenu={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>{contract?.title}</DialogTitle></DialogHeader>
        <div className="relative h-[70vh] overflow-hidden rounded-2xl border bg-muted/40 select-none">
          {err ? (
            <p className="p-6 text-sm text-muted-foreground">File not available.</p>
          ) : !url ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : contract?.mime_type === "application/pdf" ? (
            <iframe title={contract.title} src={`${url}#toolbar=0&navpanes=0`} className="h-full w-full" />
          ) : (
            <img src={url} alt={contract?.title} draggable={false} className="h-full w-full object-contain" />
          )}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -inset-1/2 flex rotate-[-30deg] flex-col justify-around">
              {Array.from({ length: 14 }).map((_, i) => (
                <p key={i} className="whitespace-nowrap text-sm font-semibold tracking-widest text-destructive/20">
                  {Array.from({ length: 4 }).map(() => stamp).join("     ")}
                </p>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
