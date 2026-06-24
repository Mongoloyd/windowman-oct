import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeMonotonicStage,
  isStageAllowedForAction,
  stageRank,
  STAGE_RANK,
} from "../_shared/arbitrageCaptureToken.ts";

Deno.test("stageRank maps known funnel stages", () => {
  assertEquals(stageRank("arb_contact"), STAGE_RANK.arb_contact);
  assertEquals(stageRank("arb_identity"), STAGE_RANK.arb_identity);
  assertEquals(stageRank("arb_call_intent"), STAGE_RANK.arb_call_intent);
  assertEquals(stageRank("arb_complete"), STAGE_RANK.arb_complete);
  assertEquals(stageRank(null), null);
  assertEquals(stageRank("unknown"), null);
});

Deno.test("computeMonotonicStage never regresses funnel_stage", () => {
  assertEquals(computeMonotonicStage("arb_contact", "arb_identity"), "arb_identity");
  assertEquals(computeMonotonicStage("arb_call_intent", "arb_identity"), "arb_call_intent");
  assertEquals(computeMonotonicStage("arb_complete", "arb_call_intent"), "arb_complete");
  assertEquals(computeMonotonicStage("arb_complete", "arb_identity"), "arb_complete");
});

Deno.test("isStageAllowedForAction enforces progressive order", () => {
  assertEquals(isStageAllowedForAction("update_identity", "arb_contact"), true);
  assertEquals(isStageAllowedForAction("update_identity", "arb_complete"), true);
  assertEquals(isStageAllowedForAction("update_identity", null), false);

  assertEquals(isStageAllowedForAction("update_call_intent", "arb_contact"), false);
  assertEquals(isStageAllowedForAction("update_call_intent", "arb_identity"), true);
  assertEquals(isStageAllowedForAction("update_call_intent", "arb_complete"), true);

  assertEquals(isStageAllowedForAction("update_timeframe", "arb_identity"), false);
  assertEquals(isStageAllowedForAction("update_timeframe", "arb_contact"), false);
  assertEquals(isStageAllowedForAction("update_timeframe", "arb_call_intent"), true);
  assertEquals(isStageAllowedForAction("update_timeframe", "arb_complete"), true);
});
