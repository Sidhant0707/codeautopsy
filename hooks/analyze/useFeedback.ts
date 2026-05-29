"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";

interface UseFeedbackOptions {
  /**
   * The repo name or identifier used as the `debug_id` in Supabase.
   * Falls back to `repoUrl`, then `"local-upload"` if neither is available.
   */
  repoName: string | null | undefined;
  repoUrl: string | null | undefined;
  /** Called after feedback is submitted when `exitAfter` is true. */
  onExit: () => void;
  /** Called to close the exit modal regardless of exit intent. */
  onCloseExitModal: () => void;
}

interface UseFeedbackReturn {
  feedbackSubmitted: boolean;
  hideFeedback: boolean;
  /**
   * @param isHelpful - Whether the user found the analysis helpful.
   * @param exitAfter - If true, closes the exit modal and calls `onExit` after
   *   the Supabase insert completes (fire-and-forget; errors are swallowed).
   */
  handleFeedback: (isHelpful: boolean, exitAfter?: boolean) => Promise<void>;
}

/**
 * Owns the feedback UI state and the Supabase persistence side-effect.
 *
 * The Supabase insert is fire-and-forget: errors are logged but never surfaced
 * to the user, matching the original behaviour in page.tsx.
 */
export function useFeedback({
  repoName,
  repoUrl,
  onExit,
  onCloseExitModal,
}: UseFeedbackOptions): UseFeedbackReturn {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hideFeedback, setHideFeedback] = useState(false);

  const handleFeedback = useCallback(
    async (isHelpful: boolean, exitAfter = false) => {
      setFeedbackSubmitted(true);

      if (exitAfter) {
        onCloseExitModal();
      } else {
        // Auto-hide the inline feedback widget after the success animation
        // completes (2 seconds), matching the original behaviour.
        setTimeout(() => setHideFeedback(true), 2000);
      }

      try {
        const supabase = createClient();
        await supabase.from("debug_feedback").insert([
          {
            debug_id: repoName ?? repoUrl ?? "local-upload",
            is_helpful: isHelpful,
          },
        ]);
      } catch (err) {
        console.error("Feedback insert failed:", err);
      }

      if (exitAfter) {
        onExit();
      }
    },
    [repoName, repoUrl, onExit, onCloseExitModal],
  );

  return {
    feedbackSubmitted,
    hideFeedback,
    handleFeedback,
  };
}