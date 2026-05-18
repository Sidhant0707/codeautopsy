"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, AlertCircle, FileArchive } from "lucide-react";
import JSZip from "jszip";
import { m, AnimatePresence } from "framer-motion";

// --- PRINCIPAL UPGRADE: 50MB Limit to prevent browser RAM crashes ---
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export default function ZipUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const processZipFile = useCallback(async (file: File) => {
    setError(null);

    // --- PRINCIPAL UPGRADE: Strict pre-flight checks ---
    if (
      !file.name.toLowerCase().endsWith(".zip") &&
      file.type !== "application/zip"
    ) {
      setError("Invalid format. Please upload a standard .zip archive.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max limit is 50MB.`,
      );
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const zip = new JSZip();
          const contents = await zip.loadAsync(arrayBuffer);

          const extractedFiles: { path: string; content: string }[] = [];
          const filePromises: Promise<void>[] = [];

          const blockedDirs = [
            "node_modules/",
            ".git/",
            ".next/",
            "dist/",
            "build/",
            "coverage/",
            "vendor/",
          ];
          const blockedExts = [
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".ico",
            ".svg",
            ".mp4",
            ".pdf",
            ".zip",
            ".lock",
            ".exe",
            ".dll",
          ];

          contents.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            if (blockedDirs.some((dir) => relativePath.includes(dir))) return;
            if (
              blockedExts.some((ext) =>
                relativePath.toLowerCase().endsWith(ext),
              )
            )
              return;

            filePromises.push(
              zipEntry.async("string").then((text) => {
                if (text.trim().length > 0) {
                  extractedFiles.push({ path: relativePath, content: text });
                }
              }),
            );
          });

          await Promise.all(filePromises);

          const prioritizedFiles = extractedFiles
            .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
            .slice(0, 40);

          if (prioritizedFiles.length === 0) {
            setError("No readable source code files found in this archive.");
            setIsProcessing(false);
            return;
          }

          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              isLocal: true,
              repoUrl: "Local.zip Codebase",
              localFiles: prioritizedFiles,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
              errorData?.error || "Failed to route files to AI engine.",
            );
          }

          const data = await response.json();

          // --- PRINCIPAL UPGRADE: QuotaExceededError Guardrail ---
          try {
            sessionStorage.setItem("localAnalysisResult", JSON.stringify(data));
          } catch (storageErr) {
            console.error("Session storage full:", storageErr);
            throw new Error(
              "Analysis payload too large for local browser storage. Please try a smaller repository.",
            );
          }

          router.push("/analyze?source=local");
        } catch (innerErr) {
          setError(
            innerErr instanceof Error
              ? innerErr.message
              : "Failed to parse repository structure.",
          );
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError(
          "Browser failed to read the file. The file may be locked or corrupted.",
        );
        setIsProcessing(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Critical extraction error:", error);
      setError("Failed to extract the .zip file. It may be corrupted.");
      setIsProcessing(false);
    }
  }, [router]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processZipFile(file);
  }, [processZipFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processZipFile(file);
      // Reset input so the same file can be selected again if it failed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- PRINCIPAL UPGRADE: Keyboard A11y Handler ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isProcessing) fileInputRef.current?.click();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <AnimatePresence mode="wait">
        {error && (
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-red-400 uppercase tracking-widest">
                Upload Failed
              </span>
              <span className="text-xs font-mono text-red-400/80 mt-1">
                {error}
              </span>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        ref={fileInputRef}
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        role="button"
        tabIndex={isProcessing ? -1 : 0}
        aria-label="Upload ZIP file dropzone"
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full p-10 sm:p-16 border-2 border-dashed rounded-3xl transition-all duration-300 flex flex-col items-center justify-center text-center outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] overflow-hidden group
          ${
            isDragging
              ? "border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.15)]"
              : "border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02] hover:border-white/20"
          }
          ${isProcessing ? "pointer-events-none cursor-wait" : "cursor-pointer"}
        `}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <m.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center relative z-10"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin" />
                <div className="absolute inset-1 border-r-2 border-emerald-500 rounded-full animate-[spin_2s_reverse_infinite]" />
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-sm m-2">
                  <FileArchive className="w-5 h-5 text-slate-300 animate-pulse" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-2 uppercase tracking-widest font-mono">
                Extracting Codebase...
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Filtering artifacts & prioritizing source files
              </p>
            </m.div>
          ) : (
            <m.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center pointer-events-none relative z-10"
            >
              <div className="w-16 h-16 bg-[#141414] border border-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-white/10 transition-all duration-300 shadow-xl">
                <UploadCloud
                  className={`w-8 h-8 transition-colors duration-300 ${isDragging ? "text-blue-400" : "text-slate-400 group-hover:text-slate-300"}`}
                />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3 cabinet">
                Upload Local Project
              </h3>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                Drag & drop a{" "}
                <span className="text-blue-400 font-mono bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold">
                  .zip
                </span>{" "}
                of your codebase here, or click to browse.
              </p>
              <p className="text-[10px] uppercase tracking-widest font-mono text-slate-500 mt-6 font-bold">
                Max Size: 50MB
              </p>
            </m.div>
          )}
        </AnimatePresence>

        {/* Ambient drag glow effect */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-3xl pointer-events-none" />
        )}
      </div>
    </div>
  );
}
