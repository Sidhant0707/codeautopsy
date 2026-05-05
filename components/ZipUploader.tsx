"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import JSZip from "jszip";

export default function ZipUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const processZipFile = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      alert("Please upload a valid .zip file");
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
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
        ];

        contents.forEach((relativePath, zipEntry) => {
          if (zipEntry.dir) return;
          if (blockedDirs.some((dir) => relativePath.includes(dir))) return;
          if (
            blockedExts.some((ext) => relativePath.toLowerCase().endsWith(ext))
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
          alert("No readable code files found in this .zip.");
          setIsProcessing(false);
          return;
        }

        
        console.log(
          `Sending ${prioritizedFiles.length} prioritized files to AI...`,
        );

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
          throw new Error(errorData?.error || "Failed to analyze local files");
        }

        const data = await response.json();
        sessionStorage.setItem("localAnalysisResult", JSON.stringify(data));
        setIsProcessing(false);
        router.push("/analyze?source=local");
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Critical error unzipping file:", error);
      alert(
        "Failed to parse the .zip file. It might be corrupted or too large.",
      );
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processZipFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processZipFile(file);
  };

  return (
    <>
      <input
        type="file"
        accept=".zip"
        className="hidden"
        ref={fileInputRef}
        onChange={handleChange}
        aria-label="Upload ZIP file"
        title="Upload ZIP file"
      />
      <div
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative w-full p-10 border-2 border-dashed rounded-3xl transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer
          ${
            isDragging
              ? "border-amber-500 bg-amber-500/10"
              : "border-white/10 bg-black/40 hover:bg-white/[0.02] hover:border-white/20"
          }
          ${isProcessing ? "pointer-events-none" : ""}
        `}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">
              Unpacking Codebase...
            </h3>
            <p className="text-sm text-slate-400">
              Filtering node_modules and routing to AI engine.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center pointer-events-none">
            <div className="p-4 bg-[#141414] border border-white/5 rounded-2xl mb-4">
              <UploadCloud className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">
              Upload Local Project
            </h3>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Drag & drop a{" "}
              <span className="text-amber-500/80 font-mono bg-amber-500/10 px-1 rounded">
                .zip
              </span>{" "}
              of your codebase. <br />
              (node_modules and build folders are automatically ignored)
            </p>
          </div>
        )}
      </div>
    </>
  );
}
