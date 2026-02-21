/**
 * Utility helpers for @systemoperator/runs
 */

import type { Run, Step, Call, RunStatus, StepStatus, CallStatus } from './types';

const TERMINAL_RUN: RunStatus[] = ['completed', 'failed'];
const TERMINAL_STEP: StepStatus[] = ['completed', 'failed', 'skipped'];
const TERMINAL_CALL: CallStatus[] = ['success', 'error'];

/** Check if a run is in a terminal state */
export function isRunComplete(run: Run): boolean {
  return TERMINAL_RUN.includes(run.status);
}

/** Check if a step is in a terminal state */
export function isStepComplete(step: Step): boolean {
  return TERMINAL_STEP.includes(step.status);
}

/** Check if a call is in a terminal state */
export function isCallComplete(call: Call): boolean {
  return TERMINAL_CALL.includes(call.status);
}

/** Calculate duration in ms between a start date and an end date (defaults to now) */
export function calculateDuration(startedAt: Date | null, endedAt?: Date): number | null {
  if (!startedAt) return null;
  return (endedAt ?? new Date()).getTime() - startedAt.getTime();
}

/** Merge increments into existing output counters */
export function mergeOutputIncrements(
  current: Record<string, any> | null,
  increments: Record<string, number>,
): Record<string, any> {
  const result = { ...(current || {}) };
  for (const [key, delta] of Object.entries(increments)) {
    result[key] = (typeof result[key] === 'number' ? result[key] : 0) + delta;
  }
  return result;
}

/** Get human-readable status summary for a run */
export function getRunSummary(run: Run): string {
  switch (run.status) {
    case 'pending':
      return `${run.runType} waiting to start`;
    case 'running':
      return run.currentStep
        ? `${run.runType} running: ${run.currentStep}`
        : `${run.runType} running`;
    case 'completed':
      return run.durationMs
        ? `${run.runType} completed in ${formatDuration(run.durationMs)}`
        : `${run.runType} completed`;
    case 'failed':
      return run.error
        ? `${run.runType} failed: ${run.error}`
        : `${run.runType} failed`;
  }
}

/** Format milliseconds to human-readable duration */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}
