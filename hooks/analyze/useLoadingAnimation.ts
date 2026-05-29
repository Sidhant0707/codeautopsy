"use client";

import { useState, useEffect } from "react";
import { useAnimationControls } from "framer-motion";
import { LOADING_PHRASES } from "@/components/analyze/constants";

export type LoadingControls = ReturnType<typeof useAnimationControls>;

interface UseLoadingAnimationReturn {
  loadingStep: number;
  loadingControls: LoadingControls;
}

/**
 * Drives the loading screen phrase animation.
 *
 * Cycles through `LOADING_PHRASES` with a fade-out / increment / fade-in
 * loop for as long as `loading` is `true`. The loop is cancelled cleanly
 * via the `isActive` flag when the effect tears down.
 *
 * @param loading - Should be `true` while data is still being fetched.
 */
export function useLoadingAnimation(
  loading: boolean,
): UseLoadingAnimationReturn {
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingControls = useAnimationControls();

  useEffect(() => {
    if (!loading) return;

    let isActive = true;

    const animate = async () => {
      while (isActive) {
        await loadingControls.start({
          opacity: [0, 1],
          transition: { duration: 0.4, ease: "easeOut" },
        });

        await new Promise<void>((resolve) => setTimeout(resolve, 800));

        await loadingControls.start({
          opacity: [1, 0],
          transition: { duration: 0.4, ease: "easeIn" },
        });

        if (isActive) {
          setLoadingStep((prev) => (prev + 1) % LOADING_PHRASES.length);
        }
      }
    };

    animate();

    return () => {
      isActive = false;
    };
  }, [loading, loadingControls]);

  return { loadingStep, loadingControls };
}