import type { BrandModel, Evidence, LayerKey, ModelPatch } from "../model";
import type { MergeOptions } from "../merge";

/** One line in the live findings list the user watches while a stage runs. */
export interface Finding {
  id: string;
  label: string;
  detail?: string;
  status: "done" | "warn" | "error" | "info";
  swatches?: string[];
  fonts?: string[];
  image?: string;
}

export interface StageContext {
  /** Push a finding as soon as it's known (shown live in the UI). */
  report: (f: Finding) => void;
}

export interface StagePatch {
  patch: ModelPatch;
  options: MergeOptions;
}

export interface StageResult {
  /** Several patches can be applied with different confidence/source. */
  patches: StagePatch[];
  evidence?: Evidence[];
  /** Deterministic warnings shown on the brand profile (e.g. contrast). */
  issues?: string[];
  /** Arbitrary output a later stage or the UI may use. */
  output?: Record<string, unknown>;
}

export interface StageDefinition<Input = Record<string, unknown>> {
  id: string;
  label: string;
  reads: LayerKey[];
  writes: LayerKey[];
  run(model: BrandModel, input: Input, ctx: StageContext): Promise<StageResult>;
}
