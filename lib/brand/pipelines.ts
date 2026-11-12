import type { BrandModel } from "./model";
import { mergePatch } from "./merge";
import { ingestStage } from "./stages/ingest";
import { extractStage } from "./stages/extract";
import { contentSystemStage } from "./stages/content-system";
import { validateStage } from "./stages/validate";
import { directionsStage } from "./stages/directions";
import type { Finding, StageDefinition } from "./stages/types";
import type { Compliance } from "./model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STAGES: Record<string, StageDefinition<any>> = {
  [ingestStage.id]: ingestStage,
  [extractStage.id]: extractStage,
  [contentSystemStage.id]: contentSystemStage,
  [validateStage.id]: validateStage,
  [directionsStage.id]: directionsStage,
};

/** A path through the loop is just an ordered list of stages. */
export const PIPELINES = {
  analyse: ["ingest", "extract", "content-system", "validate"],
  // Build and Refine reuse the same engine; their interview/direction stages plug in here.
  build: ["content-system", "validate"],
  refine: ["ingest", "extract", "content-system", "validate"],
} as const;
export type PipelineId = keyof typeof PIPELINES;

export interface RunResult {
  model: BrandModel;
  findings: Finding[];
  issues: string[];
  applied: string[];
  skippedLocked: string[];
  /** Combined `output` of the stages (e.g. Build directions). */
  output: Record<string, unknown>;
}

/** Runs stages in order, merging each patch (lock-aware) before the next stage reads the model. */
export async function runStages(
  stageIds: readonly string[],
  initial: BrandModel,
  input: Record<string, unknown>,
  onFinding: (f: Finding) => void = () => {}
): Promise<RunResult> {
  let model = initial;
  let carry: Record<string, unknown> = { ...input };
  const findings = new Map<string, Finding>();
  const issues: string[] = [];
  const applied: string[] = [];
  const skippedLocked: string[] = [];
  let output: Record<string, unknown> = {};

  const report = (f: Finding) => {
    findings.set(f.id, f);
    onFinding(f);
  };

  for (const id of stageIds) {
    const stage = STAGES[id];
    if (!stage) throw new Error(`Unknown stage "${id}"`);
    const result = await stage.run(model, carry, { report });
    for (const { patch, options } of result.patches) {
      const merged = mergePatch(model, patch, options);
      model = merged.model;
      applied.push(...merged.applied);
      skippedLocked.push(...merged.skippedLocked);
    }
    if (result.evidence?.length) model = { ...model, evidence: [...model.evidence.filter((e) => !result.evidence!.some((n) => n.source === e.source)), ...result.evidence] };
    const compliance = result.output?.compliance as Compliance | undefined;
    if (compliance) model = { ...model, compliance };
    if (result.issues) issues.push(...result.issues);
    carry = { ...carry, ...(result.output ?? {}) };
    output = { ...output, ...(result.output ?? {}) };
  }

  // Raw website evidence is large and already summarised in model.evidence.
  delete output.website;
  return { model, findings: [...findings.values()], issues, applied, skippedLocked, output };
}
