import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { prepareFile, type PreparedFile } from "@/lib/upload";
import { formatFileSize } from "@/lib/format";

type Props = {
  docType: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  value: PreparedFile | null;
  onChange: (value: PreparedFile | null) => void;
};

export function UploadField({ docType, label, required, disabled, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleSelect(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const prepared = await prepareFile(docType, file);
      onChange(prepared);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
      onChange(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void handleSelect(e.target.files?.[0])}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          Choose file
        </Button>
        {value ? (
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-foreground">{value.originalName}</span>
            <span className="shrink-0 text-muted-foreground">({formatFileSize(value.size)})</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label={`Remove ${label}`}
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">JPG, PNG or PDF · max 10 MB</span>
        )}
      </div>
    </div>
  );
}
