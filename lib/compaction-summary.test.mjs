import assert from "node:assert/strict";
import test from "node:test";
import { parseCompactionSummary } from "./compaction-summary.ts";

test("separates pi file metadata tags from the visible compaction summary", () => {
  const parsed = parseCompactionSummary(`## Goal
Keep the important user intent.

<read-files>
/tmp/a.ts
/tmp/b.ts
</read-files>

<modified-files>
/tmp/changed.ts
</modified-files>`);

  assert.equal(parsed.body, "## Goal\nKeep the important user intent.");
  assert.deepEqual(parsed.readFiles, ["/tmp/a.ts", "/tmp/b.ts"]);
  assert.deepEqual(parsed.modifiedFiles, ["/tmp/changed.ts"]);
});

test("leaves normal summaries unchanged", () => {
  const summary = "## Goal\nNo file metadata here.";

  assert.deepEqual(parseCompactionSummary(summary), {
    body: summary,
    readFiles: [],
    modifiedFiles: [],
  });
});

test("deduplicates file metadata while preserving the first-seen order", () => {
  const parsed = parseCompactionSummary(`Summary.

<read-files>
/tmp/b.ts
/tmp/a.ts
/tmp/b.ts
</read-files>

<modified-files>
/tmp/a.ts
/tmp/a.ts
/tmp/b.ts
</modified-files>`);

  assert.equal(parsed.body, "Summary.");
  assert.deepEqual(parsed.readFiles, ["/tmp/b.ts", "/tmp/a.ts"]);
  assert.deepEqual(parsed.modifiedFiles, ["/tmp/a.ts", "/tmp/b.ts"]);
});

test("keeps file-like tags that are part of the summary body", () => {
  const summary = `## Critical Context
The user asked what this compact metadata means: <read-files>example</read-files>.

More summary text after the mention.`;

  assert.deepEqual(parseCompactionSummary(summary), {
    body: summary,
    readFiles: [],
    modifiedFiles: [],
  });
});
