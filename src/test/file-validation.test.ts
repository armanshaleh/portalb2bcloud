import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "../lib/file-validation";
describe("private upload validation", () => {
  const pdf = { originalName: "test.pdf", mimeType: "application/pdf", size: 8, dataBase64: btoa("%PDF-1.7") };
  it("accepts a matching PDF signature", () => expect(validateUpload(pdf).length).toBe(8));
  it("rejects a mismatched declared size", () => expect(() => validateUpload({ ...pdf, size: 1 })).toThrow());
  it("rejects an executable renamed by MIME alone", () => expect(() => validateUpload({ ...pdf, originalName: "test.exe" })).toThrow());
  it("rejects forged PDF content", () => expect(() => validateUpload({ ...pdf, dataBase64: btoa("notapdf!") })).toThrow());
  it("enforces the 10 MB limit on decoded bytes", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10485760);
    const data = "a".repeat(10485761);
    expect(() => validateUpload({ ...pdf, size: data.length, dataBase64: btoa(data) })).toThrow();
  });
});