"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TAB_CONFIG,
  MAP_VIEW_CONFIG,
  TabType,
  MapViewType,
} from "@/components/analyze/constants";

interface UseAnalyzeUIStateOptions {
  /**
   * Called when Escape is pressed and the GitHub auth modal is the active
   * layer. The caller owns that modal's visibility state, so we delegate the
   * navigation action rather than importing the router here.
   */
  onEscapeFromAuthModal: () => void;
  /** Whether the GitHub auth modal is currently visible. */
  showGitHubAuthModal: boolean;
  /** Whether the mount flag has been set (prevents SSR sessionStorage reads). */
  isMounted: boolean;
}

interface UseAnalyzeUIStateReturn {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  mapView: MapViewType;
  setMapView: (view: MapViewType) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  showExitModal: boolean;
  setShowExitModal: (open: boolean) => void;
}

/**
 * Owns all ephemeral UI state for the analyze page.
 *
 * Responsibilities:
 * - `activeTab` and `mapView` with `sessionStorage` persistence
 * - `isChatOpen` and `showExitModal` panel visibility
 * - Global Escape key handler (dispatches to the correct layer)
 */
export function useAnalyzeUIState({
  onEscapeFromAuthModal,
  showGitHubAuthModal,
  isMounted,
}: UseAnalyzeUIStateOptions): UseAnalyzeUIStateReturn {
  // ─── Tab & View State ────────────────────────────────────────────────────────
  // Safe synchronous initialization: sessionStorage is only read in the browser.

  const [activeTab, setActiveTabRaw] = useState<TabType>(() => {
    if (typeof window === "undefined") return "overview";
    const saved = sessionStorage.getItem("codeautopsy_tab");
    return saved && TAB_CONFIG.some((t) => t.id === saved)
      ? (saved as TabType)
      : "overview";
  });

  const [mapView, setMapViewRaw] = useState<MapViewType>(() => {
    if (typeof window === "undefined") return "graph";
    const saved = sessionStorage.getItem("codeautopsy_view");
    return saved && MAP_VIEW_CONFIG.some((v) => v.id === saved)
      ? (saved as MapViewType)
      : "graph";
  });

  // ─── Panel Visibility ────────────────────────────────────────────────────────

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // ─── sessionStorage Sync ─────────────────────────────────────────────────────
  // Only write after the component has mounted to avoid SSR mismatches.

  useEffect(() => {
    if (!isMounted) return;
    sessionStorage.setItem("codeautopsy_tab", activeTab);
  }, [activeTab, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    sessionStorage.setItem("codeautopsy_view", mapView);
  }, [mapView, isMounted]);

  // ─── Escape Key Handler ───────────────────────────────────────────────────────
  // Layers (highest priority first):
  //   1. Exit modal
  //   2. GitHub auth modal → delegate navigation to caller
  //   3. Chat panel

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showExitModal) {
        setShowExitModal(false);
      } else if (showGitHubAuthModal) {
        onEscapeFromAuthModal();
      } else if (isChatOpen) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showExitModal, showGitHubAuthModal, isChatOpen, onEscapeFromAuthModal]);

  // ─── Stable Setters ───────────────────────────────────────────────────────────
  // Wrapped in useCallback so consumers can use them in their own dependency
  // arrays without risking stale-closure issues.

  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabRaw(tab);
  }, []);

  const setMapView = useCallback((view: MapViewType) => {
    setMapViewRaw(view);
  }, []);

  return {
    activeTab,
    setActiveTab,
    mapView,
    setMapView,
    isChatOpen,
    setIsChatOpen,
    showExitModal,
    setShowExitModal,
  };
}