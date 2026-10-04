// docs/CONSENT.md as data (CLAUDE.md non-negotiable 10). The same rules as
// pipeline/asknoor/consent.py: a person needs a row for the scope, its status must be exactly
// `confirmed`, the scope is a whole word, and a row that reads as a refusal never counts.
// Pure: callers read the file.

export interface ConsentRow {
  person: string;
  what: string;
  where: string;
  date: string;
  status: string;
}

export const CONFIRMED = "confirmed";
const NEGATION = /\b(not|no|never|without|except|revoked|withdrawn)\b/i;

/** The rows of the Markdown tables in CONSENT.md, keyed by their own header cells. */
export function parseConsent(markdown: string): ConsentRow[] {
  const rows: ConsentRow[] = [];
  let header: string[] | null = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      header = null; // any other line ends the table; the next one has its own header
      continue;
    }
    const cells = line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    if (/^[-: ]+$/.test(cells.join(""))) continue;
    if (header === null) {
      header = cells.map((c) => c.toLowerCase());
      continue;
    }
    if (cells.length !== header.length) continue; // malformed rows fail closed
    const get = (name: string) => cells[header?.indexOf(name) ?? -1] ?? "";
    rows.push({
      person: get("person"),
      what: get("what they consented to"),
      where: get("where"),
      date: get("date"),
      status: get("status"),
    });
  }
  return rows;
}

const covers = (what: string, scope: string) =>
  new RegExp(`\\b${scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(what);

/** Throw unless `person` has rows for `scope` and every one is exactly `confirmed`. */
export function requireConfirmed(rows: readonly ConsentRow[], person: string, scope: string): void {
  const matching = rows.filter(
    (r) => r.person.toLowerCase() === person.toLowerCase() && covers(r.what, scope),
  );
  if (matching.length === 0) throw new Error(`no consent row for ${person} (${scope})`);
  for (const row of matching) {
    if (NEGATION.test(row.what))
      throw new Error(`the consent row for ${person} (${scope}) reads as a refusal or a limit`);
    if (row.status !== CONFIRMED) {
      throw new Error(`consent for ${person} (${scope}) is '${row.status}', not '${CONFIRMED}'`);
    }
  }
}
