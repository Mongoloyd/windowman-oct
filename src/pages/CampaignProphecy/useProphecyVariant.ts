import { useEffect, useState } from "react";
import {
  ACTIVE_PROPHECY_VARIANTS,
  ALL_PROPHECY_VARIANTS,
  DEFAULT_PROPHECY_VARIANT_ID,
  type ProphecyVariant,
} from "./prophecyVariants";

const STORAGE_KEY = "wm_prophecy_variant";

function pickWeightedVariant(): string {
  const candidates = ACTIVE_PROPHECY_VARIANTS.map(
    (id) => ALL_PROPHECY_VARIANTS[id],
  ).filter(Boolean);
  if (candidates.length === 0) return DEFAULT_PROPHECY_VARIANT_ID;

  const totalWeight = candidates.reduce(
    (sum, variant) => sum + variant.weight,
    0,
  );
  let roll = Math.random() * totalWeight;
  for (const variant of candidates) {
    roll -= variant.weight;
    if (roll <= 0) return variant.id;
  }
  return candidates[0].id;
}

function resolveVariant(): { id: string; isUrlOverride: boolean } {
  if (typeof window === "undefined") {
    return {
      id: ACTIVE_PROPHECY_VARIANTS[0] ?? DEFAULT_PROPHECY_VARIANT_ID,
      isUrlOverride: false,
    };
  }

  // 1. ?v= override — for review. Deliberately not persisted, so sharing a
  //    review link cannot pin a real visitor to that variant.
  const urlVariant = new URLSearchParams(window.location.search).get("v");
  if (urlVariant && ALL_PROPHECY_VARIANTS[urlVariant]) {
    return { id: urlVariant, isUrlOverride: true };
  }

  // 2. Previously assigned, and still in the active set.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (
      stored &&
      ALL_PROPHECY_VARIANTS[stored] &&
      ACTIVE_PROPHECY_VARIANTS.includes(stored)
    ) {
      return { id: stored, isUrlOverride: false };
    }
  } catch {
    // localStorage blocked — fall through to a fresh assignment.
  }

  return { id: pickWeightedVariant(), isUrlOverride: false };
}

/**
 * Assigns and persists the Prophecy hero variant.
 *
 * Resolution: `?v=` (session-only) → localStorage → weighted random.
 * Resolved once on mount so the copy cannot change across a re-render.
 */
export function useProphecyVariant(): ProphecyVariant {
  const [resolved] = useState(resolveVariant);

  useEffect(() => {
    if (!resolved.isUrlOverride) {
      try {
        localStorage.setItem(STORAGE_KEY, resolved.id);
      } catch {
        // Non-fatal: the visitor simply gets re-assigned next visit.
      }
    }
  }, [resolved]);

  return (
    ALL_PROPHECY_VARIANTS[resolved.id] ??
    ALL_PROPHECY_VARIANTS[DEFAULT_PROPHECY_VARIANT_ID]
  );
}
