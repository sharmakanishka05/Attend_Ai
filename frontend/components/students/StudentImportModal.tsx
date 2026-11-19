"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import { StudentImportPreview } from "@/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { downloadBlob } from "@/lib/utils";

const supportedFile = z.instanceof(File).refine((file) => /\.(csv|xlsx|xls)$/i.test(file.name), "Choose a CSV or Excel file.").refine((file) => file.size <= 8 * 1024 * 1024, "Import files must be 8 MB or smaller.");

export function StudentImportModal({ isOpen, onClose, onImported }: { isOpen: boolean; onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = () => { setPreview(null); setMessage(null); onClose(); };
  const chooseFile = async (file?: File) => {
    if (!file) return;
    const validation = supportedFile.safeParse(file);
    if (!validation.success) return setMessage(validation.error.issues[0].message);
    setLoading(true); setMessage(null);
    try { setPreview(await api.previewStudentImport(file)); }
    catch (error: any) { setMessage(error.message || "We could not read this file."); }
    finally { setLoading(false); }
  };
  const commit = async () => {
    if (!preview || preview.valid_count === 0) return;
    setLoading(true); setMessage(null);
    try {
      const result = await api.commitStudentImport({ filename: preview.filename, rows: preview.rows, mapping: preview.proposed_mapping, source_type: preview.filename.endsWith(".csv") ? "csv" : "excel" });
      setMessage(`${result.imported_count} student record${result.imported_count === 1 ? "" : "s"} imported. ${result.failed_count} rows need attention.`);
      onImported();
    } catch (error: any) { setMessage(error.message || "The import could not be committed."); }
    finally { setLoading(false); }
  };
  const template = async () => { try { downloadBlob(await api.getStudentTemplate(), "kit-student-import-template.csv"); } catch (error: any) { setMessage(error.message); } };

  return <Modal isOpen={isOpen} onClose={reset} title="Import student records" description="Nothing is saved until you review the mapping and confirm the valid rows." maxWidth="lg">
    <div className="space-y-4 text-left">
      {!preview ? <div className="rounded-2xl border-2 border-dashed border-border bg-subtle/60 p-8 text-center">
        <FileSpreadsheet className="mx-auto h-9 w-9 text-accent" />
        <h3 className="mt-3 text-[15px] font-semibold text-primary-text">Bring your own student data</h3>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-secondary-text">CSV and Excel files are checked for missing IDs, duplicate roll numbers, invalid emails, and phone-number formats before any data is added.</p>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="primary" size="sm" isLoading={loading} leftIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => inputRef.current?.click()}>Choose file</Button><Button variant="outline" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={template}>Template</Button></div>
      </div> : <>
        <div className="grid grid-cols-3 gap-3"><Metric label="Ready" value={preview.valid_count} tone="text-success" /><Metric label="Needs fixes" value={preview.error_count} tone={preview.error_count ? "text-danger" : "text-primary-text"} /><Metric label="Columns found" value={preview.headers.length} tone="text-primary-text" /></div>
        <div className="rounded-xl border border-border bg-subtle/70 p-3"><p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Detected mapping</p><div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(preview.proposed_mapping).map(([from, to]) => <span key={from} className="rounded-full bg-white px-2 py-1 text-[10px] text-secondary-text shadow-sm">{from} <ArrowRight className="mx-0.5 inline h-2.5 w-2.5" /> <strong className="text-primary-text">{to}</strong></span>)}</div></div>
        {preview.error_count > 0 && <div className="rounded-xl border border-danger-border bg-danger-subtle p-3"><div className="flex gap-2 text-[12px] font-semibold text-danger"><AlertCircle className="h-4 w-4" />Rows needing correction</div><ul className="mt-2 space-y-1 text-[11px] text-secondary-text">{preview.errors.slice(0, 5).map((row) => <li key={row.row}>Row {row.row}: {row.errors.join(" · ")}</li>)}</ul></div>}
        <div className="overflow-hidden rounded-xl border border-border"><div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-subtle text-secondary-text"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Roll no.</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Section</th></tr></thead><tbody>{preview.preview.slice(0, 6).map((row) => <tr key={row.row} className="border-t border-border/60"><td className="px-3 py-2 font-mono text-secondary-text">{row.row}</td><td className="px-3 py-2 font-semibold">{row.data.name}</td><td className="px-3 py-2 font-mono">{row.data.roll_number}</td><td className="px-3 py-2">{row.data.class_name}</td><td className="px-3 py-2">{row.data.section}</td></tr>)}</tbody></table></div></div>
      </>}
      {message && <div className={`flex gap-2 rounded-xl p-3 text-[12px] ${message.includes("imported") ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}><CheckCircle2 className="h-4 w-4" />{message}</div>}
      <div className="flex justify-between border-t border-border pt-4"><Button variant="ghost" size="sm" onClick={preview ? () => setPreview(null) : reset}>{preview ? "Choose another file" : "Cancel"}</Button>{preview && <Button variant="primary" size="sm" isLoading={loading} disabled={!preview.valid_count} onClick={commit}>Import {preview.valid_count} valid rows</Button>}</div>
    </div>
  </Modal>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="rounded-xl border border-border bg-white p-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">{label}</div><div className={`mt-1 text-[22px] font-bold tabular-nums ${tone}`}>{value}</div></div>; }
