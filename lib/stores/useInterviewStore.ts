// lib/stores/useInterviewStore.ts

import { create } from "zustand";

type InterviewStore = {
  activeNodes: string[];
  isInterviewMode: boolean;
  setActiveNodes: (nodes: string[]) => void;
  setInterviewMode: (value: boolean) => void;
  clearActiveNodes: () => void;
};

export const useInterviewStore = create<InterviewStore>((set) => ({
  activeNodes: [],
  isInterviewMode: false,
  setActiveNodes: (nodes) => set({ activeNodes: nodes }),
  setInterviewMode: (value) => set({ isInterviewMode: value }),
  clearActiveNodes: () => set({ activeNodes: [] }),
}));