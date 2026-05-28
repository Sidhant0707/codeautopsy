// lib/interview/chat-logic.ts
import { useInterviewStore } from "@/lib/stores/useInterviewStore";

export type AIInterviewResponse = {
  message: string;
  targetFiles: string[];
};

export type InterviewChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export const INTERVIEW_SYSTEM_PROMPT = `You are a senior software engineer running a structured code review interview.
You have full context about a codebase. Your job is to ask focused, targeted questions about specific files and guide the user through understanding the architecture.
You must ALWAYS respond using this exact JSON format:
{"message": "Your question or response here", "targetFiles": ["exact/path/to/file.ts"]}
Rules:
- targetFiles must only contain exact file paths as they appear in the provided codebase context
- If no specific files are relevant, use an empty array: {"message": "...", "targetFiles": []}
- Never output any text outside the JSON object`;

// ============================================================================
// RESPONSE PARSER
// ============================================================================

function tryParseAIResponse(rawText: string): AIInterviewResponse | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const isValid =
      typeof parsed.message === "string" &&
      Array.isArray(parsed.targetFiles) &&
      parsed.targetFiles.every((item: unknown) => typeof item === "string");
    if (!isValid) return null;
    return {
      message: parsed.message,
      targetFiles: parsed.targetFiles.map((filePath: string) =>
        filePath.replace(/^\//, "").trim(),
      ),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// STREAMING MESSAGE EXTRACTOR
//
// The AI streams raw JSON like:  {"message": "Can you explain auth.ts?", ...}
// This regex extracts only the visible text inside the "message" field as
// tokens arrive, so the UI shows clean text — not raw JSON syntax.
// ============================================================================

function extractStreamingMessage(accumulated: string): string {
  // Match content inside "message": "..." — handles partial/in-flight JSON
  const match = accumulated.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return "";
  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

// ============================================================================
// STREAM CALLBACKS
// ============================================================================

export type StreamCallbacks = {
  /** Called on every token with the current visible message text */
  onToken: (visibleText: string) => void;
  /** Called once the stream ends with the final parsed message + target files */
  onComplete: (finalMessage: string, targetFiles: string[]) => void;
  /** Called on non-abort errors */
  onError: (errorMessage: string) => void;
};

// ============================================================================
// MAIN HANDLER — replaces the old accumulateGroqStream pattern
//
// Before: waited for [DONE], then popped the full message into chat at once.
// After:  emits visible text on every token (real-time typing effect), then
//         parses targetFiles from the complete JSON on completion.
// ============================================================================

export async function handleInterviewStreamResponse(
  stream: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { setActiveNodes, clearActiveNodes } = useInterviewStore.getState();
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let streamDone = false;

  try {
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        const stripped = line.replace(/^data: /, "");

        if (stripped === "[DONE]") {
          streamDone = true;
          break;
        }

        if (line.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(stripped);
            const token = parsed.choices?.[0]?.delta?.content;
            if (typeof token === "string") {
              fullText += token;
              // Emit only the visible message content — not raw JSON
              const visibleText = extractStreamingMessage(fullText);
              if (visibleText) {
                callbacks.onToken(visibleText);
              }
            }
          } catch {
            // Partial SSE chunk — safe to ignore
          }
        }
      }
    }

    // ── Stream complete: parse final JSON for message + targetFiles ──
    const parsed = tryParseAIResponse(fullText);

    if (parsed) {
      callbacks.onComplete(parsed.message, parsed.targetFiles);
      if (parsed.targetFiles.length > 0) {
        setActiveNodes(parsed.targetFiles);
      } else {
        clearActiveNodes();
      }
    } else {
      // Fallback: show raw text if JSON parse failed
      const fallback = fullText.trim() || "No response received.";
      callbacks.onComplete(fallback, []);
      clearActiveNodes();
    }
  } catch (err) {
    if (err instanceof Error && err.name !== "AbortError") {
      callbacks.onError("[SYSTEM ERROR: Interview stream disconnected.]");
    }
    clearActiveNodes();
  }
}