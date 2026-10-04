import { E5WorkerMatcher } from "./e5-matcher.ts";
import { DexieOutbox } from "./outbox.ts";
import { LocalPackRepository } from "./pack-repository.ts";
import type { Services } from "./types.ts";

// The pack folder: the committed fixture by default; the real demo pack locally via VITE_PACK_BASE.
export const PACK_BASE = import.meta.env.VITE_PACK_BASE ?? "/packs/fixture";

export function createServices(): Services {
  const repo = new LocalPackRepository({ base: PACK_BASE });
  return { repo, matcher: new E5WorkerMatcher(repo), outbox: new DexieOutbox() };
}
