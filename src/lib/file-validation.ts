export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateUpload(file: { originalName: string; mimeType: string; size: number; dataBase64: string }): Uint8Array {
  let binary: string;
  try { binary = atob(file.dataBase64); } catch { throw new Error("Invalid file encoding."); }
  if (!binary.length || binary.length > MAX_UPLOAD_BYTES || binary.length !== file.size) throw new Error("Invalid file size; maximum is 10 MB.");
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const extension = file.originalName.split(".").pop()?.toLowerCase();
  const valid = file.mimeType === "application/pdf"
    ? extension === "pdf" && binary.startsWith("%PDF-")
    : file.mimeType === "image/png"
      ? extension === "png" && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
      : file.mimeType === "image/jpeg" && (extension === "jpg" || extension === "jpeg") && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("File content does not match an allowed JPG, PNG or PDF.");
  return bytes;
}