"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowLeft,
  Clock,
  ShieldCheck,
  AlertCircle,
  ImageUp,
  ScanFace,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CameraCapture } from "@/components/attendance/CameraCapture";
import { FileUploader } from "@/components/attendance/FileUploader";
import { FaceOverlay } from "@/components/attendance/FaceOverlay";
import { AttendanceReview } from "@/components/attendance/AttendanceReview";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import {
  ClassModel,
  Student,
  AttendanceSession,
  ProcessImageResult,
  AttendanceItem,
  DetectedFace,
} from "@/types";

type WorkflowStep = "setup" | "capture" | "processing" | "review" | "confirmed";

export default function AttendancePage() {
  const { success, error } = useToast();

  // Workflow Step
  const [step, setStep] = useState<WorkflowStep>("setup");
  const [captureMode, setCaptureMode] = useState<"camera" | "upload">("upload");

  // Session Setup State
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [sessionTime, setSessionTime] = useState<string>("09:00 AM");
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);

  // Capture & Processing State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // AI Recognition Results
  const [processResult, setProcessResult] = useState<ProcessImageResult | null>(null);
  const [attendanceItems, setAttendanceItems] = useState<AttendanceItem[]>([]);
  const [unknownFaces, setUnknownFaces] = useState<DetectedFace[]>([]);
  const [allEnrolledStudents, setAllEnrolledStudents] = useState<Student[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const slotId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("slot_id");
    if (!slotId) return;
    api.openTimetableSession(slotId)
      .then((session) => {
        setActiveSession(session);
        setSelectedClassId(session.class_id);
        setSessionTitle(session.title);
        setSessionDate(session.date);
        setSessionTime(session.time);
        setStep("capture");
      })
      .catch((requestError) => error(requestError.message || "Could not open the scheduled attendance period."));
  }, []);

  const loadInitialData = async () => {
    try {
      const cls = await api.getClasses();
      setClasses(cls);
      if (cls.length > 0) {
        setSelectedClassId(cls[0].id);
        setSessionTitle(`${cls[0].course || cls[0].name} — ${cls[0].section}`);
      }
      const st = await api.getStudents();
      setAllEnrolledStudents(st);
    } catch (err) {
      console.warn("Failed to load live class data:", err);
      setClasses([]);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const found = classes.find((c) => c.id === classId);
    if (found) {
      setSessionTitle(`${found.course || found.name} — ${found.section}`);
    }
  };

  const startSession = async () => {
    if (!selectedClassId) {
      error("Please select a class first.");
      return;
    }

    try {
      const session = await api.createSession({
        class_id: selectedClassId,
        date: sessionDate,
        time: sessionTime,
        title: sessionTitle || "Class Attendance",
      });
      setActiveSession(session);
      setStep("capture");
      success("Attendance session initialized. Choose camera or photo upload.");
    } catch (err: any) {
      error(err.message || "The attendance session could not be created. Please try again.");
    }
  };

  // AI Pipeline Execution
  const handleProcessImage = async (file?: File, base64?: string) => {
    setStep("processing");
    setProcessingStage(1); // Image validated

    const timer1 = setTimeout(() => setProcessingStage(2), 500); // Detecting faces
    const timer2 = setTimeout(() => setProcessingStage(3), 1100); // Generating face embeddings
    const timer3 = setTimeout(() => setProcessingStage(4), 1600); // Matching students

    try {
      const formData = new FormData();
      if (selectedClassId) formData.append("class_id", selectedClassId);
      if (file) formData.append("file", file);
      if (base64) formData.append("image_base64", base64);

      const result = await api.processAttendanceImage(formData);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!result || result.total_detected === 0) {
        setProcessingError("No faces were detected in this image. Please ensure adequate lighting and center the classroom.");
        setStep("capture");
        error("No faces detected in photo.");
        return;
      }

      setProcessResult(result);

      // Build review items from REAL AI detection
      const items: AttendanceItem[] = [];
      const unknowns: DetectedFace[] = [];

      result.faces.forEach((f) => {
        if (f.student_id && f.student_name) {
          items.push({
            student_id: f.student_id,
            student_name: f.student_name,
            roll_number: f.roll_number || "Unassigned",
            status: f.status === "review" ? "late" : "present",
            confidence: f.confidence,
            marked_method: "ai_upload",
            face_crop_base64: f.face_crop_base64,
          });
        } else {
          unknowns.push(f);
        }
      });

      setAttendanceItems(items);
      setUnknownFaces(unknowns);
      setStep("review");
      success(
        `Detected ${result.total_detected} faces: ${result.recognized_count} recognized, ${result.unknown_count} unknown.`
      );
    } catch (err: any) {
      const message = err instanceof ApiError && err.status === 401
        ? "Your sign-in has expired. Please sign in again, then retry the photo."
        : err instanceof ApiError && err.status >= 500
          ? "The recognition service could not analyze this photo right now. Your session is still active; please try again shortly."
          : err.message || "Failed to process attendance image.";
      setProcessingError(message);
      error(message);
      setStep("capture");
    }
  };

  const handleUpdateStatus = (
    studentId: string,
    newStatus: "present" | "absent" | "late",
    reason: string
  ) => {
    setAttendanceItems((prev) =>
      prev.map((item) =>
        item.student_id === studentId
          ? {
              ...item,
              status: newStatus,
              is_modified: true,
              correction_reason: reason,
            }
          : item
      )
    );
    success("Updated status for student. Reason will be saved with the attendance review.");
  };

  const handleAssignUnknown = (boxId: string, studentId: string, reason: string) => {
    const student = allEnrolledStudents.find((s) => s.id === studentId);
    if (!student) return;

    // Add to recognized review items
    setAttendanceItems((prev) => [
      ...prev,
      {
        student_id: student.id,
        student_name: student.name,
        roll_number: student.roll_number,
        status: "present",
        confidence: 0.9,
        marked_method: "manual",
        is_modified: true,
        correction_reason: reason,
      },
    ]);

    // Remove from unknown faces list
    setUnknownFaces((prev) => prev.filter((f) => f.box_id !== boxId));
    success(`Assigned face to ${student.name}.`);
  };

  const handleDismissUnknown = (boxId: string) => {
    setUnknownFaces((prev) => prev.filter((f) => f.box_id !== boxId));
    success("Unknown face dismissed.");
  };

  const handleConfirmAttendance = async () => {
    if (!activeSession) return;
    setIsSubmitting(true);
    try {
      await api.confirmAttendance({
        session_id: activeSession.id,
        items: attendanceItems.map((item) => ({
          student_id: item.student_id,
          status: item.status,
          confidence: item.confidence,
          marked_method: item.marked_method,
        })),
        unknown_faces_handled: unknownFaces.length,
        notes: "Automated AI attendance verification session",
      });

      setStep("confirmed");
      success("Attendance confirmed and records safely stored!");
    } catch (err: any) {
      error(err.message || "Attendance could not be saved. Your review is still open so you can retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClass = classes.find((classroom) => classroom.id === selectedClassId);

  return (
    <div className="space-y-6 text-left">
      <div className="futuristic-hero relative overflow-hidden rounded-[18px] px-5 py-6 md:px-7">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[28px] border-[var(--accent)]/70" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.13em] text-accent">
              <ScanFace className="h-4 w-4" /> KIT Kanpur · Attendance studio
            </div>
            <h1 className="mt-2 font-display text-[34px] leading-none text-primary-text md:text-[40px]">Take attendance with confidence.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-secondary-text">
              Start a live session, then use your camera or a classroom photo. Recognition results always remain reviewable before they are saved.
            </p>
          </div>

          {step !== "setup" && (
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setStep("setup")}>
              Start new session
            </Button>
          )}
        </div>
        <div className="relative mt-6 grid max-w-2xl grid-cols-3 gap-2 text-[11px] font-semibold">
          {[{ key: "setup", label: "Session" }, { key: "capture", label: "Capture" }, { key: "review", label: "Review" }].map((item, index) => {
            const active = item.key === step || (item.key === "capture" && step === "processing") || (item.key === "review" && step === "confirmed");
            const complete = (item.key === "setup" && step !== "setup") || (item.key === "capture" && ["review", "confirmed"].includes(step));
            return <div key={item.key} className={`flex items-center gap-2 rounded-full px-3 py-2 transition-colors duration-200 ${active ? "bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20" : complete ? "bg-[var(--surface)]/80 text-accent" : "bg-[var(--surface)]/45 text-secondary-text"}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-current/15 text-[9px]">{complete ? "✓" : index + 1}</span>{item.label}</div>;
          })}
        </div>
      </div>

      {/* STEP 1: SETUP SESSION */}
      {step === "setup" && (
        <div className="glass-card max-w-3xl p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-accent">Step 1 of 3</p>
              <h2 className="mt-1 text-[18px] font-semibold text-primary-text">Session details</h2>
            <p className="text-[13px] text-secondary-text">
              Select class, section, and schedule before capturing attendance.
            </p>
            </div>
            {selectedClass && <div className="rounded-xl border border-border bg-subtle px-3 py-2 text-right"><div className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text">Selected roster</div><div className="mt-0.5 text-[14px] font-semibold text-primary-text">{selectedClass.student_count} students</div></div>}
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-primary-text mb-1.5">
                Class & Section
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full h-9 border border-border rounded-control px-3 text-[14px] bg-white focus:outline-none focus:border-accent"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course ? `${c.course} — ${c.section}` : `${c.name} — ${c.section}`} ({c.student_count} enrolled students)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-primary-text mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full h-9 border border-border rounded-control px-3 text-[14px] bg-white focus:outline-none focus:border-accent font-mono"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-primary-text mb-1.5">
                  Time
                </label>
                <input
                  type="text"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  className="w-full h-9 border border-border rounded-control px-3 text-[14px] bg-white focus:outline-none focus:border-accent font-mono"
                  placeholder="09:00 AM"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-primary-text mb-1.5">
                Session Title
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="w-full h-9 border border-border rounded-control px-3 text-[14px] bg-white focus:outline-none focus:border-accent"
                placeholder="e.g. Database Systems — Section A"
              />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border flex justify-end">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Camera className="w-4 h-4" />}
              onClick={startSession}
            >
              Start Attendance Session
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: CAPTURE / UPLOAD */}
      {step === "capture" && (
        <div className="space-y-6">
          {processingError && (
            <div className="p-4 bg-danger-subtle border border-danger-border rounded-card text-danger space-y-3">
              <div className="flex items-start gap-2.5 text-[13.5px]">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[14px]">We couldn't analyze this image.</span>
                  <p className="text-[13px] text-primary-text mt-0.5 leading-relaxed">{processingError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setProcessingError(null);
                    if (selectedFile) handleProcessImage(selectedFile);
                    else if (capturedBase64) handleProcessImage(undefined, capturedBase64);
                  }}
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProcessingError(null);
                    setSelectedFile(null);
                    setCapturedBase64(null);
                  }}
                >
                  Choose Another Photo
                </Button>
              </div>
            </div>
          )}

          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
            <button
              onClick={() => setCaptureMode("upload")}
              className={`group rounded-[18px] border p-4 text-left transition-all ${
                captureMode === "upload"
                  ? "border-accent bg-accent-subtle shadow-lg shadow-[var(--accent)]/10"
                  : "glass-card border-border hover:border-accent hover:bg-subtle"
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${captureMode === "upload" ? "bg-accent text-white" : "bg-subtle text-accent"}`}><ImageUp className="h-5 w-5" /></span>
              <span className="mt-3 block text-[14px] font-semibold text-primary-text">Upload a classroom photo</span>
              <span className="mt-1 block text-[12px] leading-relaxed text-secondary-text">Best for a group photo already on your phone or computer.</span>
            </button>
            <button
              onClick={() => setCaptureMode("camera")}
              className={`group rounded-[18px] border p-4 text-left transition-all ${
                captureMode === "camera"
                  ? "border-accent bg-accent-subtle shadow-lg shadow-[var(--accent)]/10"
                  : "glass-card border-border hover:border-accent hover:bg-subtle"
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${captureMode === "camera" ? "bg-accent text-white" : "bg-subtle text-accent"}`}><Video className="h-5 w-5" /></span>
              <span className="mt-3 block text-[14px] font-semibold text-primary-text">Use the live camera</span>
              <span className="mt-1 block text-[12px] leading-relaxed text-secondary-text">Capture a frame now and inspect the recognition result before saving.</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-secondary-text"><ShieldCheck className="h-4 w-4 text-accent" /> You can correct or dismiss every detection during review.</div>

          {captureMode === "camera" ? (
            <CameraCapture
              sessionId={activeSession?.id}
              classId={selectedClassId}
              onCapture={(base64) => {
                setCapturedBase64(base64);
                handleProcessImage(undefined, base64);
              }}
              onCancel={() => setCaptureMode("upload")}
            />
          ) : (
            <div className="max-w-3xl space-y-4">
              <FileUploader
                selectedFile={selectedFile}
                onFileSelect={(file) => {
                  setSelectedFile(file);
                }}
                onClear={() => setSelectedFile(null)}
              />

              {selectedFile && (
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Sparkles className="w-4 h-4" />}
                    onClick={() => handleProcessImage(selectedFile)}
                  >
                    Process Classroom Photo
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: MEANINGFUL PROGRESS LOADING UI */}
      {step === "processing" && (
        <div className="glass-card mx-auto my-12 max-w-md p-6 text-left">
          <div className="text-[15px] font-semibold text-primary-text mb-1">
            Analyzing classroom photo
          </div>
          <p className="text-[13px] text-secondary-text mb-5">
            Running multi-face detection, ArcFace embedding extraction, and student matching.
          </p>

          <div className="space-y-3 font-mono text-[13px]">
            <div className="flex items-center justify-between text-success">
              <span>Image validated</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>

            <div
              className={`flex items-center justify-between ${
                processingStage >= 2 ? "text-success" : "text-secondary-text"
              }`}
            >
              <span>Detecting all faces</span>
              {processingStage >= 2 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span className="animate-spin text-accent">●</span>
              )}
            </div>

            <div
              className={`flex items-center justify-between ${
                processingStage >= 3 ? "text-success" : "text-secondary-text"
              }`}
            >
              <span>Generating face embeddings</span>
              {processingStage >= 3 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : processingStage === 2 ? (
                <span className="animate-spin text-accent">●</span>
              ) : (
                <span className="text-muted-text">○</span>
              )}
            </div>

            <div
              className={`flex items-center justify-between ${
                processingStage >= 4 ? "text-success" : "text-secondary-text"
              }`}
            >
              <span>Matching enrolled students</span>
              {processingStage >= 4 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : processingStage === 3 ? (
                <span className="animate-spin text-accent">●</span>
              ) : (
                <span className="text-muted-text">○</span>
              )}
            </div>

            <div
              className={`flex items-center justify-between ${
                processingStage >= 4 ? "text-accent" : "text-muted-text"
              }`}
            >
              <span>Preparing attendance review</span>
              {processingStage >= 4 ? (
                <span className="animate-pulse">●</span>
              ) : (
                <span>○</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: FACE OVERLAY & ATTENDANCE REVIEW */}
      {step === "review" && (
        <div className="space-y-6">
          {/* Image with Face Bounding Boxes */}
          {processResult && (
            <FaceOverlay
              imageUrl={
                processResult.processed_image_data ||
                capturedBase64 ||
                (selectedFile ? URL.createObjectURL(selectedFile) : "")
              }
              faces={processResult.faces}
              selectedBoxId={selectedBoxId}
              onSelectFace={(f) => setSelectedBoxId(f.box_id)}
            />
          )}

          {/* Human-in-the-loop review table */}
          <AttendanceReview
            items={attendanceItems}
            unknownFaces={unknownFaces}
            allStudents={allEnrolledStudents}
            onUpdateStatus={handleUpdateStatus}
            onAssignUnknown={handleAssignUnknown}
            onDismissUnknown={handleDismissUnknown}
            onConfirm={handleConfirmAttendance}
            onCancel={() => setStep("capture")}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* STEP 5: CONFIRMATION SUCCESS */}
      {step === "confirmed" && (
        <div className="max-w-lg mx-auto my-10 bg-white border border-border rounded-card p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-success-subtle text-success mx-auto flex items-center justify-center border border-success-border">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-[20px] font-semibold text-primary-text tracking-tight">
            Attendance Successfully Confirmed
          </h2>
          <p className="text-[13.5px] text-secondary-text max-w-sm mx-auto leading-relaxed">
            Session for <strong>{sessionTitle}</strong> has been marked as completed. All attendance records and audit logs have been safely stored without duplicates.
          </p>

          <div className="p-3 bg-subtle border border-border rounded-control flex justify-around text-[13px] font-mono">
            <div>
              <span className="text-secondary-text block text-[11px]">Present</span>
              <span className="text-success font-semibold">
                {attendanceItems.filter((i) => i.status === "present").length}
              </span>
            </div>
            <div>
              <span className="text-secondary-text block text-[11px]">Late</span>
              <span className="text-warning font-semibold">
                {attendanceItems.filter((i) => i.status === "late").length}
              </span>
            </div>
            <div>
              <span className="text-secondary-text block text-[11px]">Absent</span>
              <span className="text-danger font-semibold">
                {attendanceItems.filter((i) => i.status === "absent").length}
              </span>
            </div>
          </div>

          <div className="pt-3 flex justify-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setStep("setup");
                setSelectedFile(null);
                setCapturedBase64(null);
                setProcessResult(null);
              }}
            >
              Take Another Class
            </Button>
            <a href="/">
              <Button variant="primary" size="md">
                Go to Dashboard
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
