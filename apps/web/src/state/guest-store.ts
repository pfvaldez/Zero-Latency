import type { VisitorLang } from "@asknoor/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tab = "stops" | "ask" | "shop" | "feedback";

interface GuestState {
  /** The guest's language. Persisted: asked once, kept for the whole tour. */
  lang: VisitorLang | null;
  tab: Tab;
  /** The clip being played, if any. */
  clipId: number | null;
  /** When set, the player plays only this moment of the clip (after the guest confirms a match). */
  momentId: string | null;
  setLang: (lang: VisitorLang | null) => void;
  setTab: (tab: Tab) => void;
  openClip: (clipId: number, momentId?: string | null) => void;
  closeClip: () => void;
}

export const useGuest = create<GuestState>()(
  persist(
    (set) => ({
      lang: null,
      tab: "stops",
      clipId: null,
      momentId: null,
      setLang: (lang) => set({ lang }),
      setTab: (tab) => set({ tab }),
      openClip: (clipId, momentId = null) => set({ clipId, momentId }),
      closeClip: () => set({ clipId: null, momentId: null }),
    }),
    { name: "asknoor-guest", partialize: (s) => ({ lang: s.lang }) },
  ),
);
