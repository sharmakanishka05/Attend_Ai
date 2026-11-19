"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, X, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  selectedFile,
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setError(null);

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid image (JPG, PNG, or WEBP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("File is too large. Maximum supported upload is 15MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    onClear();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full text-left">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="mb-3 p-3 bg-danger-subtle border border-danger-border rounded-control text-danger text-[13px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {selectedFile && previewUrl ? (
        <div className="glass-card overflow-hidden">
          <div className="relative flex aspect-video items-center justify-center bg-[var(--bg)] p-3">
            <img
              src={previewUrl}
              alt="Classroom photo preview"
              className="h-full w-full rounded-xl object-contain"
            />
            <button
              onClick={clearSelection}
              aria-label="Remove image"
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-[13px]">
            <div className="truncate pr-2">
              <span className="font-medium text-primary-text block truncate">
                {selectedFile.name}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-secondary-text">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to analyze
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Replace Photo
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative overflow-hidden border-2 border-dashed rounded-[20px] p-9 text-center cursor-pointer transition-colors duration-150 ${
            isDragging
              ? "border-accent bg-accent-subtle/40"
              : "border-border hover:border-border-hover bg-white hover:bg-subtle/50"
          }`}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent shadow-sm">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="text-[15px] font-semibold text-primary-text">
            Add a classroom photo
          </div>
          <div className="text-[12px] text-secondary-text mt-1">
            or <span className="text-accent underline underline-offset-2">Browse files</span> from your computer
          </div>
          <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-1.5 text-[11px] text-muted-text">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Supports single or multi-person classroom photos (JPG, PNG, WEBP up to 15MB)
          </div>
        </div>
      )}
    </div>
  );
};
