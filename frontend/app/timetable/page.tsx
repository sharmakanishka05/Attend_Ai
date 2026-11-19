"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CircleAlert, Download, GripVertical, Loader2, MapPin, Plus, Printer, Settings2, Shuffle, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TimetableCatalog, TimetableSlot } from "@/types";
import { downloadBlob } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS = ["#3157D5", "#0F766E", "#B45309", "#9F1239", "#4D7C0F", "#7C3AED"];

const emptyCatalog: TimetableCatalog = { classes: [], subjects: [], rooms: [], periods: [], teachers: [], holidays: [] };

export default function TimetablePage() {
  const { success, error } = useToast();
  const [catalog, setCatalog] = useState<TimetableCatalog>(emptyCatalog);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [view, setView] = useState<"class" | "teacher" | "room">("class");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [dragged, setDragged] = useState<TimetableSlot | null>(null);
  const [editorSlot, setEditorSlot] = useState<TimetableSlot | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [form, setForm] = useState({ class_id: "", subject_id: "", teacher_id: "", teacher_name: "", room_id: "", period_id: "", day_of_week: 0, slot_type: "lecture", notes: "" });
  const [subjectForm, setSubjectForm] = useState({ code: "", name: "", color: COLORS[0] });
  const [roomForm, setRoomForm] = useState({ name: "", capacity: "" });
  const [periodForm, setPeriodForm] = useState({ label: "", start_time: "09:00", end_time: "09:50" });

  const filters = useMemo(() => view === "class" ? { class_id: selectedId } : view === "teacher" ? (selectedId.startsWith("name:") ? { teacher_name: selectedId.slice(5) } : { teacher_id: selectedId }) : { room_id: selectedId }, [view, selectedId]);
  const selectedLabel = useMemo(() => {
    if (view === "class") {
      const classroom = catalog.classes.find((item) => item.id === selectedId);
      return classroom ? `${classroom.name} · Section ${classroom.section}` : "Class section";
    }
    if (view === "teacher") return catalog.teachers.find((item) => item.id === selectedId)?.name || "Teacher";
    return catalog.rooms.find((item) => item.id === selectedId)?.name || "Room";
  }, [catalog, selectedId, view]);

  const load = async () => {
    setLoading(true);
    try {
      const nextCatalog = await api.getTimetableCatalog() as TimetableCatalog;
      setCatalog(nextCatalog);
      setSelectedId((current) => current || nextCatalog.classes[0]?.id || "");
      const activeId = selectedId || nextCatalog.classes[0]?.id || "";
      if (activeId) {
        const nextSlots = await api.getTimetable(view === "class" ? { class_id: activeId } : undefined) as TimetableSlot[];
        setSlots(nextSlots);
      } else {
        setSlots([]);
      }
    } catch (requestError: any) {
      error(requestError.message || "Could not load the timetable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selectedId) return;
    api.getTimetable(filters).then((result) => setSlots(result as TimetableSlot[])).catch((requestError) => error(requestError.message || "Could not load the selected timetable."));
  }, [filters]);

  const openEditor = (periodId?: string, dayOfWeek?: number, slot?: TimetableSlot) => {
    setConflicts([]);
    setEditorSlot(slot || null);
    setForm(slot ? {
      class_id: slot.class_id, subject_id: slot.subject_id, teacher_id: slot.teacher_id || "", teacher_name: slot.teacher_id ? "" : slot.teacher_name || "", room_id: slot.room_id || "", period_id: slot.period_id,
      day_of_week: slot.day_of_week, slot_type: slot.slot_type, notes: slot.notes || "",
    } : {
      class_id: view === "class" ? selectedId : catalog.classes[0]?.id || "", subject_id: catalog.subjects[0]?.id || "", teacher_id: "", teacher_name: "", room_id: "",
      period_id: periodId || catalog.periods.find((period) => !period.is_break)?.id || "", day_of_week: dayOfWeek || 0, slot_type: "lecture", notes: "",
    });
    setEditorOpen(true);
  };

  const saveSlot = async () => {
    setConflicts([]);
    try {
      if (editorSlot) await api.updateTimetableSlot(editorSlot.id, form);
      else await api.createTimetableSlot(form);
      setEditorOpen(false);
      await load();
      success(editorSlot ? "Class slot updated." : "Class slot added to the timetable.");
    } catch (requestError: any) {
      if (requestError instanceof ApiError && Array.isArray((requestError.detail as any)?.conflicts)) {
        setConflicts((requestError.detail as any).conflicts);
      } else error(requestError.message || "Could not save the class slot.");
    }
  };

  const deleteSlot = async () => {
    if (!editorSlot) return;
    try {
      await api.deleteTimetableSlot(editorSlot.id);
      setEditorOpen(false);
      await load();
      success("Class slot removed.");
    } catch (requestError: any) { error(requestError.message || "Could not delete the class slot."); }
  };

  const openAttendance = async (slot: TimetableSlot) => {
    try {
      const session = await api.openTimetableSession(slot.id);
      window.location.assign(`/attendance?session_id=${encodeURIComponent(session.id)}&slot_id=${encodeURIComponent(slot.id)}`);
    } catch (requestError: any) { error(requestError.message || "Could not open attendance for this period."); }
  };

  const moveSlot = async (targetPeriodId: string, targetDay: number, target?: TimetableSlot) => {
    if (!dragged || (dragged.period_id === targetPeriodId && dragged.day_of_week === targetDay)) return;
    try {
      if (target) await api.swapTimetableSlots(dragged.id, target.id);
      else await api.updateTimetableSlot(dragged.id, { period_id: targetPeriodId, day_of_week: targetDay });
      await load();
      success(target ? "Class slots swapped." : "Class slot moved.");
    } catch (requestError: any) { error(requestError.message || "That move causes a timetable conflict."); }
    finally { setDragged(null); }
  };

  const createCatalogItem = async (kind: "subject" | "room" | "period") => {
    try {
      if (kind === "subject") {
        await api.createSubject({ ...subjectForm, periods_per_week: 1 });
        setSubjectForm({ code: "", name: "", color: COLORS[0] });
      } else if (kind === "room") {
        await api.createRoom({ name: roomForm.name, capacity: roomForm.capacity ? Number(roomForm.capacity) : undefined });
        setRoomForm({ name: "", capacity: "" });
      } else {
        await api.createPeriod({ ...periodForm, order_index: catalog.periods.length });
        setPeriodForm({ label: "", start_time: "09:00", end_time: "09:50" });
      }
      await load();
      success(`${kind[0].toUpperCase()}${kind.slice(1)} added.`);
    } catch (requestError: any) { error(requestError.message || `Could not add ${kind}.`); }
  };

  const entries = view === "class" ? catalog.classes : view === "teacher" ? catalog.teachers.map((teacher) => ({ ...teacher, name: teacher.name, section: "" })) : catalog.rooms.map((room) => ({ ...room, section: "" }));
  const cellSlot = (periodId: string, day: number) => slots.find((slot) => slot.period_id === periodId && slot.day_of_week === day);
  const exportCsv = () => {
    const header = ["Day", "Period", "Start", "End", "Subject Code", "Subject", "Class", "Teacher", "Room", "Type"];
    const rows = slots.map((slot) => [DAYS[slot.day_of_week], slot.period_label, slot.start_time, slot.end_time, slot.subject_code, slot.subject_name, slot.class_name, slot.teacher_name, slot.room_name, slot.slot_type]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `kit-kanpur-timetable-${new Date().toISOString().slice(0, 10)}.csv`);
  };
  const autoArrange = async () => {
    if (view !== "class" || !selectedId) {
      error("Choose a class-section view before auto-arranging.");
      return;
    }
    try {
      const result = await api.autoArrangeTimetable(selectedId);
      await load();
      success(result.created.length ? `${result.created.length} class periods arranged.` : "The timetable already meets its subject frequency.");
    } catch (requestError: any) { error(requestError.message || "No conflict-free arrangement could be made."); }
  };

  return <div className="space-y-6 text-left">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Academic operations</p>
        <h1 className="mt-1 font-display text-[32px] leading-none text-primary-text">Weekly timetable</h1>
        <p className="mt-2 max-w-xl text-[14px] text-secondary-text">A live teaching schedule for Kanpur Institute of Technology. Attendance begins from the class period itself.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="md" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
        <Button variant="outline" size="md" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>
        <Button variant="outline" size="md" leftIcon={<Shuffle className="h-4 w-4" />} onClick={autoArrange}>Auto-arrange</Button>
        <Button variant="outline" size="md" leftIcon={<Settings2 className="h-4 w-4" />} onClick={() => setCatalogOpen(true)}>Manage catalog</Button>
        <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openEditor()}>Add class slot</Button>
      </div>
    </div>

    <section className="border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="flex rounded-control border border-border bg-subtle p-1">
          {(["class", "teacher", "room"] as const).map((item) => <button key={item} onClick={() => { setView(item); setSelectedId(""); }} className={`px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors ${view === item ? "bg-white text-primary-text shadow-sm" : "text-secondary-text hover:text-primary-text"}`}>By {item}</button>)}
        </div>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-9 min-w-[220px] border border-border bg-white px-3 text-[13px] text-primary-text outline-none focus:border-accent">
          {entries.map((item: any) => <option key={item.id} value={item.id}>{item.name}{item.section ? ` — ${item.section}` : ""}</option>)}
        </select>
      </div>

      {loading ? <div className="flex min-h-[360px] items-center justify-center text-secondary-text"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading schedule</div> : catalog.periods.length === 0 ? <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center"><CalendarDays className="h-8 w-8 text-accent" /><h2 className="mt-4 text-[17px] font-semibold">Start with the bell schedule</h2><p className="mt-1 max-w-sm text-[13px] text-secondary-text">Add your institution’s real periods, subjects, rooms, and class sections in the catalog. Nothing is prefilled with sample data.</p><Button className="mt-4" variant="primary" size="sm" onClick={() => setCatalogOpen(true)}>Open catalog</Button></div> : <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[115px_repeat(6,minmax(120px,1fr))] border-b border-border bg-subtle">
            <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-text">{selectedLabel}</div>
            {DAYS.map((day) => <div key={day} className="border-l border-border px-3 py-3 text-[12px] font-semibold text-primary-text">{day}</div>)}
          </div>
          {catalog.periods.map((period) => <div key={period.id} className="grid grid-cols-[115px_repeat(6,minmax(120px,1fr))] border-b border-border last:border-b-0">
            <div className="bg-subtle/60 px-4 py-4"><div className="text-[12px] font-semibold text-primary-text">{period.label}</div><div className="font-mono text-[10px] text-secondary-text">{period.start_time}–{period.end_time}</div></div>
            {DAYS.map((_, day) => {
              const slot = cellSlot(period.id, day);
              return <div key={day} onDragOver={(event) => event.preventDefault()} onDrop={() => moveSlot(period.id, day, slot)} className={`relative min-h-[104px] border-l border-border p-2 ${period.is_break ? "bg-subtle/40" : "bg-white"}`}>
                {period.is_break ? <div className="pt-7 text-center text-[11px] font-medium uppercase tracking-wider text-muted-text">Break</div> : slot ? <button draggable onDragStart={() => setDragged(slot)} onClick={() => openEditor(undefined, undefined, slot)} className="group h-full min-h-[86px] w-full border-l-4 bg-white p-2 text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm" style={{ borderLeftColor: slot.color }}>
                  <div className="flex items-start justify-between gap-1"><span className="font-mono text-[10px] font-semibold" style={{ color: slot.color }}>{slot.subject_code}</span><GripVertical className="h-3.5 w-3.5 text-muted-text opacity-0 group-hover:opacity-100" /></div>
                  <div className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-primary-text">{slot.subject_name}</div>
                  <div className="mt-2 truncate text-[10px] text-secondary-text">{slot.teacher_name}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-secondary-text"><MapPin className="h-3 w-3" />{slot.room_name}</div>
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-accent"><CheckCircle2 className="h-3 w-3" />Open class</span>
                </button> : <button onClick={() => openEditor(period.id, day)} className="flex h-full min-h-[86px] w-full items-center justify-center text-muted-text opacity-0 transition-opacity hover:bg-subtle hover:text-accent hover:opacity-100 focus:opacity-100"><Plus className="h-4 w-4" /><span className="sr-only">Add a class slot</span></button>}
                {slot && <button onClick={(event) => { event.stopPropagation(); openAttendance(slot); }} className="absolute bottom-3 right-3 rounded-full border border-accent/30 bg-white px-2 py-1 text-[10px] font-semibold text-accent shadow-sm transition-colors hover:bg-accent hover:text-white">Take attendance</button>}
              </div>;
            })}
          </div>)}
        </div>
      </div>}
    </section>
    <p className="text-[12px] text-secondary-text"><GripVertical className="mr-1 inline h-3.5 w-3.5" /> Drag a class to an empty period to move it, or onto another class in the same section to swap. Schedule conflicts are checked before saving.</p>

    <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editorSlot ? "Edit class slot" : "Add class slot"} description="A period cannot double-book its class, teacher, or room." maxWidth="md">
      <div className="space-y-4 text-left">
        {conflicts.length > 0 && <div className="border border-danger-border bg-danger-subtle p-3 text-[12px] text-danger"><CircleAlert className="mr-1 inline h-4 w-4" />{conflicts.join(" ")}</div>}
        <div className="grid grid-cols-2 gap-3"><SelectField label="Class section" value={form.class_id} onChange={(value) => setForm({ ...form, class_id: value })} options={catalog.classes.map((item) => ({ value: item.id, label: `${item.name} — ${item.section}` }))} /><SelectField label="Subject" value={form.subject_id} onChange={(value) => setForm({ ...form, subject_id: value })} options={catalog.subjects.map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` }))} /></div>
        <div className="grid grid-cols-2 gap-3"><SelectField label="Day" value={String(form.day_of_week)} onChange={(value) => setForm({ ...form, day_of_week: Number(value) })} options={DAYS.map((day, index) => ({ value: String(index), label: day }))} /><SelectField label="Period" value={form.period_id} onChange={(value) => setForm({ ...form, period_id: value })} options={catalog.periods.filter((item) => !item.is_break).map((item) => ({ value: item.id, label: `${item.label} (${item.start_time})` }))} /></div>
        <div className="grid grid-cols-2 gap-3"><SelectField label="Teacher account" value={form.teacher_id} onChange={(value) => setForm({ ...form, teacher_id: value, teacher_name: value ? "" : form.teacher_name })} options={[{ value: "", label: "No linked account" }, ...catalog.teachers.filter((item) => !item.id.startsWith("name:")).map((item) => ({ value: item.id, label: item.name }))]} /><SelectField label="Room" value={form.room_id} onChange={(value) => setForm({ ...form, room_id: value })} options={[{ value: "", label: "Room pending" }, ...catalog.rooms.map((item) => ({ value: item.id, label: item.name }))]} /></div>
        <label className="block text-[12px] font-semibold text-secondary-text">Instructor displayed on timetable<input value={form.teacher_name} disabled={Boolean(form.teacher_id)} onChange={(event) => setForm({ ...form, teacher_name: event.target.value })} placeholder="e.g. Mr. Ajeet Singh" className="mt-1 h-9 w-full border border-border px-2 text-[13px] font-normal text-primary-text outline-none disabled:bg-subtle disabled:text-muted-text focus:border-accent" /></label>
        <SelectField label="Format" value={form.slot_type} onChange={(value) => setForm({ ...form, slot_type: value })} options={[{ value: "lecture", label: "Lecture" }, { value: "lab", label: "Lab" }, { value: "tutorial", label: "Tutorial" }]} />
        <label className="block text-[12px] font-semibold text-secondary-text">Note<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[72px] w-full border border-border p-2 text-[13px] outline-none focus:border-accent" /></label>
        <div className="flex justify-between border-t border-border pt-4"><div>{editorSlot && <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={deleteSlot}>Delete</Button>}</div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>Cancel</Button><Button variant="primary" size="sm" onClick={saveSlot}>Save slot</Button></div></div>
      </div>
    </Modal>

    <Modal isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} title="Timetable catalog" description="Set up the real academic building blocks for this timetable." maxWidth="lg">
      <div className="grid gap-5 text-left md:grid-cols-3">
        <CatalogForm title="Subjects" fields={[{ label: "Code", value: subjectForm.code, set: (value) => setSubjectForm({ ...subjectForm, code: value }) }, { label: "Name", value: subjectForm.name, set: (value) => setSubjectForm({ ...subjectForm, name: value }) }]} onSubmit={() => createCatalogItem("subject")} button="Add subject" />
        <CatalogForm title="Rooms" fields={[{ label: "Room", value: roomForm.name, set: (value) => setRoomForm({ ...roomForm, name: value }) }, { label: "Capacity", value: roomForm.capacity, set: (value) => setRoomForm({ ...roomForm, capacity: value }) }]} onSubmit={() => createCatalogItem("room")} button="Add room" />
        <CatalogForm title="Periods" fields={[{ label: "Label", value: periodForm.label, set: (value) => setPeriodForm({ ...periodForm, label: value }) }, { label: "Start (HH:MM)", value: periodForm.start_time, set: (value) => setPeriodForm({ ...periodForm, start_time: value }) }, { label: "End (HH:MM)", value: periodForm.end_time, set: (value) => setPeriodForm({ ...periodForm, end_time: value }) }]} onSubmit={() => createCatalogItem("period")} button="Add period" />
      </div>
    </Modal>
  </div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block text-[12px] font-semibold text-secondary-text">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full border border-border bg-white px-2 text-[13px] font-normal text-primary-text outline-none focus:border-accent">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function CatalogForm({ title, fields, onSubmit, button }: { title: string; fields: Array<{ label: string; value: string; set: (value: string) => void }>; onSubmit: () => void; button: string }) {
  return <div className="border border-border p-4"><h3 className="text-[14px] font-semibold text-primary-text">{title}</h3><div className="mt-3 space-y-2">{fields.map((field) => <label key={field.label} className="block text-[11px] font-semibold text-secondary-text">{field.label}<input value={field.value} onChange={(event) => field.set(event.target.value)} className="mt-1 h-8 w-full border border-border px-2 text-[12px] font-normal text-primary-text outline-none focus:border-accent" /></label>)}</div><Button className="mt-3 w-full" variant="outline" size="sm" onClick={onSubmit}>{button}</Button></div>;
}
