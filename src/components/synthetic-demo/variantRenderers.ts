import type { ComponentType } from "react";
import XrayVariant from "./XrayVariant";
import LensVariant from "./LensVariant";
import ChallengeVariant from "./ChallengeVariant";
import type { SyntheticDemoVariant, VariantViewModel } from "./types";

export const VARIANT_RENDERERS: Record<SyntheticDemoVariant, ComponentType<VariantViewModel>> = {
  xray: XrayVariant, lens: LensVariant, challenge: ChallengeVariant,
};
