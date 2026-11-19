"use client";

import React, { useState } from "react";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Camera, Upload, Check, ShieldCheck, Sparkles, ChevronDown } from "lucide-react";
import { CameraCapture } from "@/components/attendance/CameraCapture";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
  classesList: Array<{ id: string; name: string; section: string }>;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  onStudentAdded,
  classesList,
}) => {
  const { success, error } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
  const [gender, setGender] = useState("");
  const [showExtendedProfile, setShowExtendedProfile] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);

  // Face Registration State
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = z.object({ name: z.string().trim().min(2, "Enter the student's full name."), roll: z.string().trim().min(2, "Enter a valid roll number."), email: z.string().trim().email("Enter a valid email address.").or(z.literal("")), phone: z.string().trim().regex(/^(\+91)?\d{10}$/, "Use a 10-digit phone number.").or(z.literal("")) }).safeParse({ name, roll: rollNumber, email, phone });
    if (!validation.success) {
      error(validation.error.issues[0].message);
      return;
    }

    const targetClass = classesList[selectedClassIndex];
    if (!targetClass) {
      error("Create a class section before adding students.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.createStudent({
        name: name.trim(),
        roll_number: rollNumber.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        batch: batch.trim() || undefined,
        gender: gender || undefined,
        class_name: targetClass.name,
        section: targetClass.section,
      });

      setCreatedStudentId(res.id);
      success(`Student ${res.name} created! Proceed to face registration.`);
      setStep(2);
    } catch (err: any) {
      error(err.message || "Failed to create student.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCapturedImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterFace = async () => {
    if (!createdStudentId || !capturedImageBase64) return;
    setIsLoading(true);
    try {
      const res = await api.registerStudentFace(
        createdStudentId,
        undefined,
        capturedImageBase64
      );
      if (res.success) {
        success("Biometric face reference registered successfully!");
        onStudentAdded();
        handleClose();
      } else {
        error(res.message || "Face registration quality check failed.");
      }
    } catch (err: any) {
      error(err.message || "Face registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName("");
    setRollNumber("");
    setEmail("");
    setPhone(""); setDepartment(""); setBatch(""); setGender(""); setShowExtendedProfile(false);
    setCreatedStudentId(null);
    setCapturedImageBase64(null);
    setShowCamera(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? "Add New Student" : "Register Face Biometrics"}
      description={
        step === 1
          ? "Enter student academic information."
          : "Add clear reference photos for automated recognition."
      }
      maxWidth="md"
    >
      {step === 1 ? (
        <form onSubmit={handleCreateStudent} className="space-y-4 text-left">
          <Input
            label="Full Name"
            placeholder="Official student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <button type="button" onClick={() => setShowExtendedProfile(!showExtendedProfile)} className="flex w-full items-center justify-between rounded-xl border border-border bg-subtle/60 px-3 py-2.5 text-left text-[12px] font-semibold text-secondary-text hover:bg-subtle"><span>Academic & contact details (optional)</span><ChevronDown className={`h-4 w-4 transition-transform ${showExtendedProfile ? "rotate-180" : ""}`} /></button>
          {showExtendedProfile && <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-subtle/30 p-3 sm:grid-cols-2">
            <Input label="Phone" placeholder="9876543210" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <Input label="Department" placeholder="Computer Applications" value={department} onChange={(event) => setDepartment(event.target.value)} />
            <Input label="Batch" placeholder="2026–2028" value={batch} onChange={(event) => setBatch(event.target.value)} />
            <label className="block text-[13px] font-medium text-primary-text">Gender<select value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1.5 h-9 w-full rounded-control border border-border bg-white px-3 text-[14px] font-normal outline-none focus:border-accent"><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option></select></label>
          </div>}

          <Input
            label="Roll Number / Student ID"
            placeholder="Official roll number"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            required
          />

          <Input
            label="Email Address (Optional)"
            type="email"
            placeholder="student@kit.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <label className="block text-[13px] font-medium text-primary-text mb-1.5">
              Class & Section
            </label>
            <select
              value={selectedClassIndex}
              onChange={(e) => setSelectedClassIndex(Number(e.target.value))}
              className="w-full h-9 border border-border rounded-control px-3 text-[14px] bg-white focus:outline-none focus:border-accent"
            >
              {classesList.map((c, idx) => (
                <option key={c.id} value={idx}>
                  {c.name} — {c.section}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
              Continue to Face Setup
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 text-left">
          {showCamera ? (
            <CameraCapture
              onCapture={(base64) => {
                setCapturedImageBase64(base64);
                setShowCamera(false);
              }}
              onCancel={() => setShowCamera(false)}
            />
          ) : (
            <>
              {capturedImageBase64 ? (
                <div className="flex flex-col items-center">
                  <div className="w-36 h-36 rounded-full overflow-hidden border-2 border-accent relative shadow-md">
                    <img
                      src={capturedImageBase64}
                      alt="Captured reference face"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-[12px] text-secondary-text">
                    Reference photo captured
                  </div>

                  <div className="w-full mt-4 p-3 bg-subtle border border-border rounded-control space-y-1.5 text-[12.5px]">
                    <div className="font-semibold text-primary-text mb-1 text-[12px] uppercase tracking-wide">
                      Ready for verification
                    </div>
                    <div className="flex items-center gap-2 text-success font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span>The server will check the face when you register.</span>
                    </div>
                    <div className="text-secondary-text">
                      Use one clear, front-facing photo with good light for the best recognition result.
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCapturedImageBase64(null)}
                    >
                      Retake / Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-control text-[12.5px] text-primary-text flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>
                      Add 2–5 clear photos from slightly different angles for reliable classroom recognition.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="p-5 border border-border rounded-card hover:border-accent hover:bg-accent-subtle/30 flex flex-col items-center justify-center gap-2 transition-colors text-center"
                    >
                      <Camera className="w-6 h-6 text-accent" />
                      <span className="text-[13px] font-semibold text-primary-text block">
                        Open Camera
                      </span>
                      <span className="text-[11px] text-secondary-text block">
                        Capture face instantly
                      </span>
                    </button>

                    <label className="p-5 border border-border rounded-card hover:border-accent hover:bg-accent-subtle/30 flex flex-col items-center justify-center gap-2 transition-colors text-center cursor-pointer">
                      <Upload className="w-6 h-6 text-accent" />
                      <span className="text-[13px] font-semibold text-primary-text block">
                        Upload Photo
                      </span>
                      <span className="text-[11px] text-secondary-text block">
                        JPG, PNG, or WEBP
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onStudentAdded();
                    handleClose();
                  }}
                >
                  Skip for Now
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRegisterFace}
                  disabled={!capturedImageBase64}
                  isLoading={isLoading}
                >
                  Register Biometrics
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
