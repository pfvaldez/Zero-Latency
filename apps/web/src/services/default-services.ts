import type { MatchResult } from "@asknoor/core";
import { DexieOutbox } from "./outbox.ts";
import { LocalPackRepository } from "./pack-repository.ts";
import type { Matcher, Services } from "./types.ts";

// The pack folder: the committed fixture by default; the real demo pack locally via VITE_PACK_BASE.
export const PACK_BASE = import.meta.env.VITE_PACK_BASE ?? "/packs/fixture";

const notYet: Matcher = {
  ready: () => Promise.resolve(),
  match: (): Promise<MatchResult[]> => Promise.resolve([]),
};

export function createServices(): Services {
  return {
    repo: new LocalPackRepository({ base: PACK_BASE }),
    matcher: notYet,
    outbox: new DexieOutbox(),
  };
}
