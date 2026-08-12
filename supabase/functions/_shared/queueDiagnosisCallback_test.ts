import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CALLBACK_CONFLICT_ERROR,
  type DiagnosisCallbackDb,
  type DiagnosisCallbackRow,
  queueDiagnosisCallback,
} from "./queueDiagnosisCallback.ts";

const LEAD = "22222222-2222-4222-8222-222222222222";
const SCAN = "11111111-1111-4111-8111-111111111111";
const OTHER_SCAN = "44444444-4444-4444-8444-444444444444";
const OTHER_LEAD = "33333333-3333-4333-8333-333333333333";
const SUB = "77777777-7777-4777-8777-777777777777";
const OTHER_SUB = "88888888-8888-4888-8888-888888888888";

function memoryDb(seed: DiagnosisCallbackRow[] = []): DiagnosisCallbackDb & {
  rows: DiagnosisCallbackRow[];
  failNextInsert?: boolean;
  uniqueNextInsert?: boolean;
  uniqueWinner?: DiagnosisCallbackRow;
} {
  const rows = [...seed];
  const db: DiagnosisCallbackDb & {
    rows: DiagnosisCallbackRow[];
    failNextInsert?: boolean;
    uniqueNextInsert?: boolean;
    uniqueWinner?: DiagnosisCallbackRow;
  } = {
    rows,
    async findBySubmissionId(id) {
      return rows.find((r) => r.diagnosis_submission_id === id) ?? null;
    },
    async findBySession(scanSessionId) {
      return rows.find((r) => r.scan_session_id === scanSessionId) ?? null;
    },
    async insertQueued(input) {
      if (db.failNextInsert) {
        db.failNextInsert = false;
        return {
          ok: false,
          uniqueViolation: false,
          message: `db down for ${input.phoneE164}`,
        };
      }
      if (db.uniqueNextInsert) {
        db.uniqueNextInsert = false;
        if (db.uniqueWinner) rows.push(db.uniqueWinner);
        return { ok: false, uniqueViolation: true };
      }
      if (
        rows.some((row) =>
          row.diagnosis_submission_id === input.diagnosisSubmissionId ||
          row.scan_session_id === input.scanSessionId
        )
      ) {
        return { ok: false, uniqueViolation: true };
      }
      const row: DiagnosisCallbackRow = {
        id: crypto.randomUUID(),
        lead_id: input.leadId,
        scan_session_id: input.scanSessionId,
        diagnosis_submission_id: input.diagnosisSubmissionId,
      };
      rows.push(row);
      return { ok: true, id: row.id };
    },
  };
  return db;
}

Deno.test("queueDiagnosisCallback inserts a new queued followup", async () => {
  const db = memoryDb();
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res.ok, true);
  if (res.ok) {
    assertEquals(res.reused, false);
    assertEquals(db.rows.length, 1);
  }
});

Deno.test("queueDiagnosisCallback reuses the same submission id", async () => {
  const existing: DiagnosisCallbackRow = {
    id: "follow-1",
    lead_id: LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  };
  const db = memoryDb([existing]);
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res.ok, true);
  if (res.ok) {
    assertEquals(res.reused, true);
    assertEquals(res.followup_id, "follow-1");
    assertEquals(db.rows.length, 1);
  }
});

Deno.test("queueDiagnosisCallback reuses a diagnosis callback for a new submission id on the same scan", async () => {
  const existing: DiagnosisCallbackRow = {
    id: "follow-session",
    lead_id: LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  };
  const db = memoryDb([existing]);
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: OTHER_SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res, {
    ok: true,
    followup_id: "follow-session",
    reused: true,
  });
  assertEquals(db.rows.length, 1);
});

Deno.test("queueDiagnosisCallback allows a new callback for a different scan", async () => {
  const db = memoryDb([{
    id: "follow-first-scan",
    lead_id: LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  }]);
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: OTHER_SCAN,
    diagnosisSubmissionId: OTHER_SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.reused, false);
  assertEquals(db.rows.length, 2);
});

Deno.test("queueDiagnosisCallback 409 on cross-binding reuse", async () => {
  const db = memoryDb([{
    id: "follow-1",
    lead_id: OTHER_LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  }]);
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.status, 409);
    assertEquals(res.error, CALLBACK_CONFLICT_ERROR);
  }
});

Deno.test("queueDiagnosisCallback 409 when a session callback belongs to another lead", async () => {
  const db = memoryDb([{
    id: "follow-session-conflict",
    lead_id: OTHER_LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  }]);
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: OTHER_SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res, {
    ok: false,
    status: 409,
    error: CALLBACK_CONFLICT_ERROR,
  });
});

Deno.test("queueDiagnosisCallback recovers from unique violation", async () => {
  const winner: DiagnosisCallbackRow = {
    id: "follow-win",
    lead_id: LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  };
  const db = memoryDb();
  db.uniqueNextInsert = true;
  db.uniqueWinner = winner;
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res.ok, true);
  if (res.ok) {
    assertEquals(res.reused, true);
    assertEquals(res.followup_id, "follow-win");
  }
});

Deno.test("queueDiagnosisCallback recovers the winning session row for concurrent new submission ids", async () => {
  const winner: DiagnosisCallbackRow = {
    id: "follow-session-win",
    lead_id: LEAD,
    scan_session_id: SCAN,
    diagnosis_submission_id: SUB,
  };
  const db = memoryDb();
  db.uniqueNextInsert = true;
  db.uniqueWinner = winner;
  const res = await queueDiagnosisCallback(db, {
    leadId: LEAD,
    scanSessionId: SCAN,
    diagnosisSubmissionId: OTHER_SUB,
    phoneE164: "+15551112222",
  });
  assertEquals(res, {
    ok: true,
    followup_id: "follow-session-win",
    reused: true,
  });
});

Deno.test("two concurrent new submission ids produce one callback row", async () => {
  const db = memoryDb();
  const [first, second] = await Promise.all([
    queueDiagnosisCallback(db, {
      leadId: LEAD,
      scanSessionId: SCAN,
      diagnosisSubmissionId: SUB,
      phoneE164: "+15551112222",
    }),
    queueDiagnosisCallback(db, {
      leadId: LEAD,
      scanSessionId: SCAN,
      diagnosisSubmissionId: OTHER_SUB,
      phoneE164: "+15551112222",
    }),
  ]);
  assertEquals(first.ok, true);
  assertEquals(second.ok, true);
  assertEquals(db.rows.length, 1);
  if (first.ok && second.ok) {
    assertEquals(first.followup_id, second.followup_id);
    assertEquals([first.reused, second.reused].sort(), [false, true]);
  }
});

Deno.test("queueDiagnosisCallback does not log raw phone on insert failure", async () => {
  const db = memoryDb();
  db.failNextInsert = true;
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);

  try {
    const res = await queueDiagnosisCallback(db, {
      leadId: LEAD,
      scanSessionId: SCAN,
      diagnosisSubmissionId: SUB,
      phoneE164: "+15551112222",
    });
    assertEquals(res.ok, false);
    assertEquals(logged, [["[queueDiagnosisCallback] insert failed"]]);
    assertEquals(JSON.stringify(logged).includes("+15551112222"), false);
  } finally {
    console.error = originalConsoleError;
  }
});
