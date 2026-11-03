export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB hard limit (spec)
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"] as const;
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export type PreparedFile = {
  docType: string;
  originalName: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side upload hardening: extension whitelist, MIME validation,
 * 10 MB size ceiling, and background image compression (max 1600px, JPEG q0.85)
 * before anything leaves the browser.
 */
export async function prepareFile(docType: string, file: File): Promise<PreparedFile> {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new Error("Only JPG, PNG or PDF files are allowed.");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Unsupported file type.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("This file exceeds the 10 MB limit.");
  }

  if (file.type === "application/pdf") {
    return {
      docType,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      dataBase64: await fileToBase64(file),
    };
  }

  // Images: compress in the background before upload.
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Image processing failed.");

  const chosen = blob.size < file.size ? blob : file;
  const mimeType = chosen === blob ? "image/jpeg" : file.type;
  const originalName =
    chosen === blob ? `${file.name.replace(/\.[^.]+$/, "")}.jpg` : file.name;

  return {
    docType,
    originalName,
    mimeType,
    size: chosen.size,
    dataBase64: await fileToBase64(chosen),
  };
}
