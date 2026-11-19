"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Upload,
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  ShieldCheck,
  Trash2,
  ScanFace,
  UserRoundCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddStudentModal } from "@/components/students/AddStudentModal";
import { StudentDrawer } from "@/components/students/StudentDrawer";
import { StudentImportModal } from "@/components/students/StudentImportModal";
import { api } from "@/lib/api";
import { Student, ClassModel } from "@/types";
import { useToast } from "@/components/ui/Toast";

export default function StudentsPage() {
  const { success, error } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [faceFilter, setFaceFilter] = useState<string>("all");

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stData, clsData] = await Promise.all([
        api.getStudents(),
        api.getClasses(),
      ]);
      setStudents(stData);
      setClasses(clsData);
    } catch (err: any) {
      console.warn("Failed to load live students data:", err);
      setStudents([]);
      setClasses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchRoll = s.roll_number.toLowerCase().includes(q);
      if (!matchName && !matchRoll) return false;
    }
    if (selectedClass !== "all" && s.class_name !== selectedClass) return false;
    if (selectedSection !== "all" && s.section !== selectedSection) return false;
    if (faceFilter === "enrolled" && !s.has_face_data) return false;
    if (faceFilter === "pending" && s.has_face_data) return false;
    return true;
  });
  const enrolledCount = students.filter((student) => student.has_face_data).length;
  const pendingCount = students.length - enrolledCount;

  return (
    <div className="space-y-6 text-left">
      {/* Top Header */}
      <div className="futuristic-hero relative overflow-hidden rounded-[18px] px-6 py-6">
        <div className="absolute -right-9 -top-10 h-40 w-40 rounded-full border-[20px] border-[var(--accent)]/70" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary-text">Student data hub</p>
          <h1 className="mt-1 font-display text-[36px] leading-none text-primary-text">
            Student records, in one place.
          </h1>
          <p className="mt-2 text-[13px] text-secondary-text">
            Review, enroll, import, and audit the source of truth for your class.
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><Button className="border-border bg-white/10 text-primary-text hover:bg-subtle" variant="secondary" size="md" leftIcon={<Upload className="w-4 h-4" />} onClick={() => setIsImportOpen(true)}>Import data</Button><Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsAddModalOpen(true)}>Add student</Button></div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary-text">Cohort health</p><h2 className="mt-1 text-[20px] font-bold tracking-tight text-primary-text">{students.length} active student records</h2><p className="mt-1 text-[12px] text-secondary-text">Face enrollment is connected to the attendance workflow.</p></div><div className="flex -space-x-2 overflow-hidden py-1">{students.filter((student) => student.profile_photo_base64).slice(0, 5).map((student) => <img key={student.id} src={student.profile_photo_base64!} alt="" className="h-10 w-10 rounded-full border-2 border-border object-cover" />)}{students.length > 5 && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-accent-subtle text-[11px] font-bold text-accent">+{students.length - 5}</span>}</div></div>
          <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-success-subtle px-3 py-2.5"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-success"><ScanFace className="h-3.5 w-3.5" /> Biometric ready</div><div className="mt-1 text-[23px] font-bold tabular-nums text-primary-text">{enrolledCount}</div></div><div className="rounded-xl bg-warning-subtle px-3 py-2.5"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning"><UserRoundCheck className="h-3.5 w-3.5" /> Needs photo</div><div className="mt-1 text-[23px] font-bold tabular-nums text-primary-text">{pendingCount}</div></div></div>
        </div>
        <div className="primary-gradient rounded-[14px] p-5"><Sparkles className="h-5 w-5" /><h2 className="mt-6 text-[18px] font-bold">Ready to grow your roster?</h2><p className="mt-1 text-[12px] leading-relaxed text-white/80">Bring a CSV or Excel sheet. Review mapping errors before a single record reaches the database.</p><button onClick={() => setIsImportOpen(true)} className="mt-4 rounded-full bg-white/95 px-3 py-2 text-[11px] font-bold text-[var(--primary)] transition-transform duration-200 hover:scale-[1.02]">Open import studio</button></div>
      </section>

      {/* Filter and Search Bar */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-secondary-text absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-[13.5px] bg-subtle border border-border rounded-control placeholder:text-muted-text focus:outline-none focus:border-accent focus:bg-white transition-colors"
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="h-9 px-3 text-[13px] bg-white border border-border rounded-control focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="h-9 px-3 text-[13px] bg-white border border-border rounded-control focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="all">All Sections</option>
            <option value="Section A">Section A</option>
            <option value="Section B">Section B</option>
            <option value="Section 1">Section 1</option>
          </select>

          {/* Biometric Status Filter */}
          <select
            value={faceFilter}
            onChange={(e) => setFaceFilter(e.target.value)}
            className="h-9 px-3 text-[13px] bg-white border border-border rounded-control focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="all">All Face Statuses</option>
            <option value="enrolled">Biometrics Registered</option>
            <option value="pending">Registration Pending</option>
          </select>
        </div>

        <div className="text-[12px] text-secondary-text">
          Showing <strong>{filteredStudents.length}</strong> students
        </div>
      </div>

      {/* Students Data Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-secondary-text text-[13.5px]">
            Loading student records...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-secondary-text space-y-3">
            <Users className="w-8 h-8 text-muted-text mx-auto" />
            <div className="font-semibold text-primary-text text-[15px]">
              No students match your filter criteria.
            </div>
            <p className="text-[13px] max-w-sm mx-auto">
              Try adjusting your search query or clear the selected filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedClass("all");
                setSelectedSection("all");
                setFaceFilter("all");
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-subtle text-[10px] font-bold uppercase tracking-[0.1em] text-secondary-text">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Face Data</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className="cursor-pointer transition-colors duration-200 hover:bg-accent-subtle"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {student.profile_photo_base64 ? <img src={student.profile_photo_base64} alt="" className="h-9 w-9 rounded-xl border border-border object-cover shadow-sm" /> : <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent-subtle text-[11px] font-semibold text-accent">{student.name.slice(0, 2).toUpperCase()}</div>}
                        <div>
                          <span className="font-semibold text-primary-text block leading-tight">
                            {student.name}
                          </span>
                          {student.email && (
                            <span className="text-[11px] text-secondary-text">
                              {student.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-secondary-text">
                      {student.roll_number}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-primary-text block">
                        {student.class_name}
                      </span>
                      <span className="text-[11px] text-secondary-text">
                        {student.section}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {student.has_face_data ? (
                        <div className="flex items-center gap-1.5 text-success text-[12px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Registered</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-text text-[12px]">
                          <span className="w-2 h-2 rounded-full bg-muted-text" />
                          <span>Pending</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-subtle rounded-full h-1.5 overflow-hidden border border-border">
                          <div
                            className={`h-full rounded-full ${
                              student.attendance_rate >= 90
                                ? "bg-success"
                                : student.attendance_rate >= 75
                                ? "bg-warning"
                                : "bg-danger"
                            }`}
                            style={{ width: `${student.attendance_rate}%` }}
                          />
                        </div>
                        <span className="font-mono text-[12px] font-medium text-primary-text">
                          {student.attendance_rate}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={student.status === "active" ? "active" : "neutral"}
                        size="sm"
                      >
                        {student.status.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="text-secondary-text hover:text-primary-text inline-flex p-1">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Flow Modal */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={loadData}
        classesList={classes.map((c) => ({ id: c.id, name: c.name, section: c.section }))}
      />

      <StudentImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImported={loadData} />

      {/* Student Detail Slide-over Drawer */}
      <StudentDrawer
        studentId={selectedStudentId}
        isOpen={!!selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
        onDataChanged={loadData}
      />
    </div>
  );
}
