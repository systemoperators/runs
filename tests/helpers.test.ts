import { describe, it, expect } from '@jest/globals';
import {
  isRunComplete,
  isStepComplete,
  isCallComplete,
  calculateDuration,
  mergeOutputIncrements,
  getRunSummary,
  formatDuration,
} from '../src/helpers';
import type { Run, Step, Call } from '../src/types';

function makeRun(overrides: Partial<Run> = {}): Run {
  const now = new Date();
  return {
    id: 'run_1',
    runType: 'test',
    trigger: 'manual',
    actorType: 'system',
    actorId: null,
    status: 'pending',
    currentStep: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    input: null,
    output: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  const now = new Date();
  return {
    id: 'step_1',
    runId: 'run_1',
    parentStepId: null,
    stepIndex: 0,
    actorType: 'system',
    actorId: null,
    stepType: 'test',
    status: 'pending',
    entityType: null,
    entityId: null,
    context: null,
    input: null,
    output: null,
    itemsTotal: null,
    itemsProcessed: null,
    itemsSucceeded: null,
    itemsFailed: null,
    attempt: 1,
    retryOf: null,
    maxRetries: null,
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCall(overrides: Partial<Call> = {}): Call {
  return {
    id: 'call_1',
    stepId: 'step_1',
    tool: 'test_api',
    operation: 'GET /test',
    input: null,
    output: null,
    status: 'pending',
    error: null,
    attempt: 1,
    retryOf: null,
    durationMs: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('isRunComplete', () => {
  it('returns false for pending/running', () => {
    expect(isRunComplete(makeRun({ status: 'pending' }))).toBe(false);
    expect(isRunComplete(makeRun({ status: 'running' }))).toBe(false);
  });

  it('returns true for completed/failed', () => {
    expect(isRunComplete(makeRun({ status: 'completed' }))).toBe(true);
    expect(isRunComplete(makeRun({ status: 'failed' }))).toBe(true);
  });
});

describe('isStepComplete', () => {
  it('returns false for pending/running', () => {
    expect(isStepComplete(makeStep({ status: 'pending' }))).toBe(false);
    expect(isStepComplete(makeStep({ status: 'running' }))).toBe(false);
  });

  it('returns true for completed/failed/skipped', () => {
    expect(isStepComplete(makeStep({ status: 'completed' }))).toBe(true);
    expect(isStepComplete(makeStep({ status: 'failed' }))).toBe(true);
    expect(isStepComplete(makeStep({ status: 'skipped' }))).toBe(true);
  });
});

describe('isCallComplete', () => {
  it('returns false for pending/running', () => {
    expect(isCallComplete(makeCall({ status: 'pending' }))).toBe(false);
    expect(isCallComplete(makeCall({ status: 'running' }))).toBe(false);
  });

  it('returns true for success/error', () => {
    expect(isCallComplete(makeCall({ status: 'success' }))).toBe(true);
    expect(isCallComplete(makeCall({ status: 'error' }))).toBe(true);
  });
});

describe('calculateDuration', () => {
  it('returns null when startedAt is null', () => {
    expect(calculateDuration(null)).toBeNull();
  });

  it('calculates duration between two dates', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-01T00:00:04Z');
    expect(calculateDuration(start, end)).toBe(4000);
  });

  it('uses now when endedAt not provided', () => {
    const start = new Date(Date.now() - 100);
    const duration = calculateDuration(start);
    expect(duration).toBeGreaterThanOrEqual(99);
    expect(duration).toBeLessThan(500);
  });
});

describe('mergeOutputIncrements', () => {
  it('creates from null', () => {
    expect(mergeOutputIncrements(null, { fetched: 10 })).toEqual({ fetched: 10 });
  });

  it('increments existing counters', () => {
    const result = mergeOutputIncrements({ fetched: 5, inserted: 3 }, { fetched: 10, updated: 2 });
    expect(result).toEqual({ fetched: 15, inserted: 3, updated: 2 });
  });

  it('handles non-number existing values', () => {
    const result = mergeOutputIncrements({ note: 'hello' }, { count: 5 });
    expect(result).toEqual({ note: 'hello', count: 5 });
  });
});

describe('getRunSummary', () => {
  it('pending run', () => {
    expect(getRunSummary(makeRun({ status: 'pending' }))).toBe('test waiting to start');
  });

  it('running with current step', () => {
    expect(getRunSummary(makeRun({ status: 'running', currentStep: 'fetch_data' }))).toBe(
      'test running: fetch_data',
    );
  });

  it('running without current step', () => {
    expect(getRunSummary(makeRun({ status: 'running' }))).toBe('test running');
  });

  it('completed with duration', () => {
    expect(getRunSummary(makeRun({ status: 'completed', durationMs: 3500 }))).toBe(
      'test completed in 3.5s',
    );
  });

  it('failed with error', () => {
    expect(getRunSummary(makeRun({ status: 'failed', error: 'timeout' }))).toBe(
      'test failed: timeout',
    );
  });
});

describe('formatDuration', () => {
  it('milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('seconds', () => {
    expect(formatDuration(3500)).toBe('3.5s');
  });

  it('minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('hours and minutes', () => {
    expect(formatDuration(3_700_000)).toBe('1h 1m');
  });
});
