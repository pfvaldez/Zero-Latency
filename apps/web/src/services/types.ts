// The small interfaces of TRD 6.2. Components get these from the ServicesProvider, so tests inject
// fakes and the real e5 worker can replace a stand-in without any caller changing.

import type { FarmPackManifest, MatchResult, OutboxItem } from "@asknoor/core";

export interface Matcher {
  ready(): Promise<void>;
  match(text: string, k?: number): Promise<MatchResult[]>;
}

export interface PackRepository {
  /** The pack saved on this phone, or null before the first download. */
  current(): Promise<FarmPackManifest | null>;
  /** The bytes the download will fetch, for the "Download size" line. Needs a signal. */
  size(): Promise<number>;
  download(onProgress: (fraction: number) => void): Promise<FarmPackManifest>;
  /** Text of a saved pack file (subtitles). Null when it is not saved. */
  text(path: string): Promise<string | null>;
  /** An object URL for a saved pack file (audio). Null when it is not saved. */
  blobUrl(path: string): Promise<string | null>;
  /** Where the pack's files live on the network (the worker loads the model and embeddings from here). */
  baseUrl(): string;
}

export interface Outbox {
  add(item: OutboxItem): Promise<void>;
  pending(): Promise<OutboxItem[]>;
  markSynced(ids: string[]): Promise<void>;
  count(): Promise<number>;
}

export interface Services {
  repo: PackRepository;
  matcher: Matcher;
  outbox: Outbox;
}
