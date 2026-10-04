import type { FarmPackManifest } from "@asknoor/core";
import { useCallback, useEffect, useState } from "react";
import { useServices } from "@/services/context.tsx";

export type PackState =
  | { status: "loading" }
  | { status: "missing"; size: number | null }
  | { status: "downloading"; progress: number }
  | { status: "error" }
  | { status: "ready"; manifest: FarmPackManifest };

/** Finds the saved pack, or offers the one-time download. */
export function usePack() {
  const { repo } = useServices();
  const [state, setState] = useState<PackState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    repo
      .current()
      .then(async (manifest) => {
        if (!live) return;
        if (manifest) return setState({ status: "ready", manifest });
        setState({ status: "missing", size: null });
        const size = await repo.size().catch(() => null);
        if (live) setState({ status: "missing", size });
      })
      .catch(() => live && setState({ status: "missing", size: null }));
    return () => {
      live = false;
    };
  }, [repo]);

  const download = useCallback(async () => {
    setState({ status: "downloading", progress: 0 });
    try {
      const manifest = await repo.download((progress) =>
        setState({ status: "downloading", progress }),
      );
      setState({ status: "ready", manifest });
    } catch {
      setState({ status: "error" });
    }
  }, [repo]);

  return { state, download };
}
