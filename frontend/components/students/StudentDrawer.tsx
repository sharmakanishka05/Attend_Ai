"use client";

import React, { useState, useEffect } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { StudentDetail } from "@/types";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  ShieldAlert,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  Mail,
  GraduationCap,
  ScanFace,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface StudentDrawerProps {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const StudentDrawer: React.FC<StudentDrawerProps> = ({
  studentId,
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const { success, error } = useToast();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    if (studentId && isOpen) {
      loadStudent(studentId);
    } else {
      setStudent(null);
    }
  }, [studentId, isOpen]);

  const loadStudent = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.getStudentDetail(id);
      setStudent(data);
    } catch (err: any) {
      error(err.message || "Failed to load student details");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurgeBiometrics = async () => {
    if (!student) return;
    setIsPurging(true);
    try {
      const res = await api.deleteStudentFaceData(student.id);
      success(res.message);
      setShowPurgeModal(false);
      loadStudent(student.id);
      onDataChanged();
    } catch (err: any) {
      error(err.message || "Failed to delete face data");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={student ? student.name : "Student Details"}
        subtitle={student ? `${student.roll_number} • ${student.class_name} - ${student.section}` : undefined}
        width="lg"
      >
        {isLoading || !student ? (
          <div className="space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-subtle" />
            <div className="h-4 bg-subtle rounded w-3/4" />
            <div className="h-4 bg-subtle rounded w-1/2" />
          </div>
        ) : (
          <div className="space-y-6 text-left">
            <section className="futuristic-hero relative overflow-hidden rounded-[14px] p-5">
              <div className="absolute -right-8 -top-9 h-28 w-28 rounded-full border-[18px] border-[var(--accent)]/70" />
              <div className="relative flex items-center gap-4">
                {student.enrollment_images?.[0]?.thumbnail_base64 ? <img src={student.enrollment_images[0].thumbnail_base64} alt={student.name} className="h-16 w-16 rounded-2xl border-2 border-border object-cover shadow-lg" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-subtle text-[18px] font-bold text-accent">{student.name.slice(0, 2).toUpperCase()}</div>}
                <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-[20px] font-bold text-primary-text">{student.name}</h3><Badge variant={student.status === "active" ? "active" : "neutral"} size="sm">{student.status.toUpperCase()}</Badge></div><div className="mt-1 font-mono text-[12px] text-secondary-text">{student.roll_number}</div>{student.email && <div className="mt-1 flex items-center gap-1.5 text-[11px] text-secondary-text"><Mail className="h-3 w-3" />{student.email}</div>}</div>
              </div>
              <div className="relative mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 text-[11px]"><div><span className="text-secondary-text">Programme</span><div className="mt-0.5 font-semibold text-primary-text">{student.course || student.class_name}</div></div><div><span className="text-secondary-text">Section</span><div className="mt-0.5 font-semibold text-primary-text">{student.section}</div></div></div>
            </section>

            {/* Attendance Overview Stats */}
            <div>
              <h4 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary-text">
                Attendance signal
              </h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-subtle p-3 rounded-control border border-border">
                  <span className="text-[11px] text-secondary-text block">Rate</span>
                  <span className="text-[18px] font-semibold text-primary-text font-mono">
                    {student.stats.rate}%
                  </span>
                </div>
                <div className="bg-success-subtle p-3 rounded-control border border-success-border">
                  <span className="text-[11px] text-success block">Present</span>
                  <span className="text-[18px] font-semibold text-success font-mono">
                    {student.stats.present}
                  </span>
                </div>
                <div className="bg-warning-subtle p-3 rounded-control border border-warning-border">
                  <span className="text-[11px] text-warning block">Late</span>
                  <span className="text-[18px] font-semibold text-warning font-mono">
                    {student.stats.late}
                  </span>
                </div>
                <div className="bg-danger-subtle p-3 rounded-control border border-danger-border">
                  <span className="text-[11px] text-danger block">Absent</span>
                  <span className="text-[18px] font-semibold text-danger font-mono">
                    {student.stats.absent}
                  </span>
                </div>
              </div>
            </div>

            {/* Biometric Face Status & Privacy Section */}
            <div className="glass-card space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-accent" />
                  <span className="text-[13.5px] font-semibold text-primary-text">
                    Biometric Face Profile
                  </span>
                </div>
                {student.has_face_data ? (
                  <Badge variant="recognized" size="sm">
                    {student.biometric_status || "ENROLLED"}
                  </Badge>
                ) : (
                  <Badge variant="unknown" size="sm">
                    NOT ENROLLED
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-subtle p-3 text-[12px] font-mono">
                <div>
                  <span className="text-secondary-text block text-[10.5px]">Model</span>
                  <span className="font-semibold text-primary-text">{student.biometric_model || "SFace"}</span>
                </div>
                <div>
                  <span className="text-secondary-text block text-[10.5px]">Dimension</span>
                  <span className="font-semibold text-primary-text">{student.embedding_dimension || 128}-D</span>
                </div>
                <div>
                  <span className="text-secondary-text block text-[10.5px]">Embeddings</span>
                  <span className="font-semibold text-primary-text">{student.embeddings_count}</span>
                </div>
              </div>

              {/* Enrollment Images Gallery */}
              {student.enrollment_images && student.enrollment_images.length > 0 && (
                <div>
                  <div className="text-[11.5px] font-medium text-secondary-text mb-2">
                    Enrollment Reference Images ({student.enrollment_images.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {student.enrollment_images.map((img) => (
                      <div
                        key={img.id}
                        className="border border-border rounded-control p-2 bg-white flex flex-col items-center text-center shadow-xs"
                      >
                        {img.thumbnail_base64 ? (
                          <img
                            src={img.thumbnail_base64}
                            alt={img.label}
                            className="w-14 h-14 object-cover rounded-control border border-border/80 mb-1.5"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-control bg-subtle border border-border flex items-center justify-center text-[10px] text-secondary-text mb-1.5 font-mono">
                            {img.label}
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-primary-text">
                          {img.label}
                        </span>
                        <span className="text-[10px] text-secondary-text">
                          {img.is_primary ? "Primary" : "Auxiliary"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11.5px] leading-relaxed text-secondary-text">
                Reference photos are kept only for approved enrollment and used to match faces during attendance review.
              </p>

              {student.has_face_data && (
                <div className="pt-2 border-t border-border flex justify-end">
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => setShowPurgeModal(true)}
                  >
                    Delete Face Data
                  </Button>
                </div>
              )}
            </div>

            {/* Attendance History Table */}
            <div>
              <h4 className="text-[13px] font-semibold text-secondary-text uppercase tracking-wider mb-2.5">
                Recent Attendance History
              </h4>
              {student.history && student.history.length > 0 ? (
                <div className="border border-border rounded-control overflow-hidden">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-subtle border-b border-border text-secondary-text text-[11px] font-medium">
                      <tr>
                        <th className="py-2 px-3">Session</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {student.history.map((h) => (
                        <tr key={h.id} className="hover:bg-subtle/40">
                          <td className="py-2.5 px-3 font-medium text-primary-text truncate max-w-[140px]">
                            {h.session_title}
                          </td>
                          <td className="py-2.5 px-3 text-secondary-text">
                            {formatDate(h.date)}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={h.status} size="sm">
                              {h.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-secondary-text">
                            {(h.confidence * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 bg-subtle rounded-control text-center text-[13px] text-secondary-text border border-border">
                  No attendance history recorded yet.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Confirmation Modal for Biometric Purge */}
      <Modal
        isOpen={showPurgeModal}
        onClose={() => setShowPurgeModal(false)}
        title="Permanently Delete Biometric Data?"
        description="This action cannot be undone."
        maxWidth="sm"
      >
        <div className="space-y-4 text-left">
          <div className="p-3 bg-danger-subtle border border-danger-border rounded-control text-danger text-[12.5px] flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              All stored face embeddings and reference images for <strong>{student?.name}</strong> will be permanently purged. Academic attendance records will remain preserved for audit compliance.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPurgeModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isPurging}
              onClick={handlePurgeBiometrics}
            >
              Confirm Purge
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
