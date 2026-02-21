import { describe, it, expect, beforeEach } from '@jest/globals';
import { RunTracker } from '../src/tracker';
import type { RunStore, Run, Step, Call } from '../src/types';

// In-memory store for testing
function createMemoryStore(): RunStore & {
  runs: Map<string, Run>;
  steps: Map<string, Step>;
  calls: Map<string, Call>;
} {
  const runs = new Map<string, Run>();
  const steps = new Map<string, Step>();
  const calls = new Map<string, Call>();

  return {
    runs,
    steps,
    calls,

    async insertRun(run) { runs.set(run.id, { ...run }); },
    async getRun(id) { const r = runs.get(id); return r ? { ...r } : null; },
    async updateRun(id, fields) {
      const r = runs.get(id);
      if (r) runs.set(id, { ...r, ...fields });
    },

    async insertStep(step) { steps.set(step.id, { ...step }); },
    async getStep(id) { const s = steps.get(id); return s ? { ...s } : null; },
    async updateStep(id, fields) {
      const s = steps.get(id);
      if (s) steps.set(id, { ...s, ...fields });
    },

    async insertCall(call) { calls.set(call.id, { ...call }); },
    async getCall(id) { const c = calls.get(id); return c ? { ...c } : null; },
    async updateCall(id, fields) {
      const c = calls.get(id);
      if (c) calls.set(id, { ...c, ...fields });
    },
  };
}

let counter = 0;
function testId(): string {
  return `id_${++counter}`;
}

describe('RunTracker', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let tracker: RunTracker;

  beforeEach(() => {
    counter = 0;
    store = createMemoryStore();
    tracker = new RunTracker({ store, generateId: testId });
  });

  describe('runs', () => {
    it('creates a run in pending state', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      expect(runId).toBe('id_1');

      const run = await store.getRun(runId);
      expect(run?.status).toBe('pending');
      expect(run?.runType).toBe('sync');
      expect(run?.trigger).toBe('cron');
      expect(run?.actorType).toBe('system');
      expect(run?.startedAt).toBeNull();
    });

    it('starts a run', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);

      const run = await store.getRun(runId);
      expect(run?.status).toBe('running');
      expect(run?.startedAt).toBeInstanceOf(Date);
    });

    it('finishes a run with duration', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);
      await tracker.finishRun(runId, { output: { count: 10 } });

      const run = await store.getRun(runId);
      expect(run?.status).toBe('completed');
      expect(run?.completedAt).toBeInstanceOf(Date);
      expect(run?.durationMs).toBeDefined();
      expect(run?.output).toEqual({ count: 10 });
      expect(run?.currentStep).toBeNull();
    });

    it('fails a run with error', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);
      await tracker.failRun(runId, 'connection timeout');

      const run = await store.getRun(runId);
      expect(run?.status).toBe('failed');
      expect(run?.error).toBe('connection timeout');
      expect(run?.completedAt).toBeInstanceOf(Date);
    });

    it('fails a run with Error object', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);
      await tracker.failRun(runId, new Error('oops'));

      const run = await store.getRun(runId);
      expect(run?.error).toBe('oops');
    });

    it('increments run output counters', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);

      await tracker.incrementRunOutput(runId, { fetched: 10, inserted: 5 });
      await tracker.incrementRunOutput(runId, { fetched: 20, updated: 3 });

      const run = await store.getRun(runId);
      expect(run?.output).toEqual({ fetched: 30, inserted: 5, updated: 3 });
    });

    it('updates currentStep', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);
      await tracker.updateRunProgress(runId, 'fetch_accounts');

      const run = await store.getRun(runId);
      expect(run?.currentStep).toBe('fetch_accounts');
    });
  });

  describe('steps', () => {
    it('creates a step in pending state', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      const stepId = await tracker.createStep(runId, { stepType: 'fetch_data' });

      const step = await store.getStep(stepId);
      expect(step?.status).toBe('pending');
      expect(step?.runId).toBe(runId);
      expect(step?.stepType).toBe('fetch_data');
      expect(step?.attempt).toBe(1);
    });

    it('creates a standalone step without run', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'one_off' });

      const step = await store.getStep(stepId);
      expect(step?.runId).toBeNull();
    });

    it('starts a step and updates run currentStep', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      await tracker.startRun(runId);
      const stepId = await tracker.createStep(runId, { stepType: 'fetch_data' });
      await tracker.startStep(stepId);

      const step = await store.getStep(stepId);
      expect(step?.status).toBe('running');
      expect(step?.startedAt).toBeInstanceOf(Date);

      const run = await store.getRun(runId);
      expect(run?.currentStep).toBe('fetch_data');
    });

    it('finishes a step', async () => {
      const runId = await tracker.createRun({ runType: 'sync', trigger: 'cron' });
      const stepId = await tracker.createStep(runId, { stepType: 'fetch_data' });
      await tracker.startStep(stepId);
      await tracker.finishStep(stepId, { output: { rows: 50 } });

      const step = await store.getStep(stepId);
      expect(step?.status).toBe('completed');
      expect(step?.output).toEqual({ rows: 50 });
      expect(step?.durationMs).toBeDefined();
    });

    it('fails a step', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'test' });
      await tracker.startStep(stepId);
      await tracker.failStep(stepId, 'bad data');

      const step = await store.getStep(stepId);
      expect(step?.status).toBe('failed');
      expect(step?.error).toBe('bad data');
    });

    it('skips a step', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'test' });
      await tracker.skipStep(stepId, 'already done');

      const step = await store.getStep(stepId);
      expect(step?.status).toBe('skipped');
      expect(step?.output).toEqual({ reason: 'already done' });
    });

    it('updates step progress', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'batch' });
      await tracker.startStep(stepId);
      await tracker.updateStepProgress(stepId, {
        itemsTotal: 100,
        itemsProcessed: 50,
        itemsSucceeded: 48,
        itemsFailed: 2,
      });

      const step = await store.getStep(stepId);
      expect(step?.itemsTotal).toBe(100);
      expect(step?.itemsProcessed).toBe(50);
      expect(step?.itemsSucceeded).toBe(48);
      expect(step?.itemsFailed).toBe(2);
    });

    it('creates nested steps', async () => {
      const runId = await tracker.createRun({ runType: 'chat', trigger: 'user' });
      const parentId = await tracker.createStep(runId, { stepType: 'query' });
      const childId = await tracker.createStep(runId, {
        stepType: 'parse_sql',
        parentStepId: parentId,
        stepIndex: 1,
      });

      const child = await store.getStep(childId);
      expect(child?.parentStepId).toBe(parentId);
      expect(child?.stepIndex).toBe(1);
    });
  });

  describe('calls', () => {
    it('creates a call in running state', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'fetch' });
      const callId = await tracker.createCall(stepId, {
        tool: 'stripe_api',
        operation: 'GET /charges',
        input: { limit: 100 },
      });

      const call = await store.getCall(callId);
      expect(call?.status).toBe('running');
      expect(call?.tool).toBe('stripe_api');
      expect(call?.operation).toBe('GET /charges');
      expect(call?.input).toEqual({ limit: 100 });
      expect(call?.attempt).toBe(1);
    });

    it('finishes a call', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'fetch' });
      const callId = await tracker.createCall(stepId, {
        tool: 'api',
        operation: 'GET',
      });
      await tracker.finishCall(callId, { output: { data: [1, 2, 3] } });

      const call = await store.getCall(callId);
      expect(call?.status).toBe('success');
      expect(call?.output).toEqual({ data: [1, 2, 3] });
      expect(call?.durationMs).toBeDefined();
    });

    it('fails a call', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'fetch' });
      const callId = await tracker.createCall(stepId, {
        tool: 'api',
        operation: 'GET',
      });
      await tracker.failCall(callId, 'rate limited');

      const call = await store.getCall(callId);
      expect(call?.status).toBe('error');
      expect(call?.error).toBe('rate limited');
    });

    it('tracks retry attempts', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'fetch' });

      const call1 = await tracker.createCall(stepId, {
        tool: 'api',
        operation: 'GET',
      });
      await tracker.failCall(call1, 'timeout');

      const call2 = await tracker.createCall(stepId, {
        tool: 'api',
        operation: 'GET',
        retryOf: call1,
      });
      await tracker.finishCall(call2);

      const retry = await store.getCall(call2);
      expect(retry?.attempt).toBe(2);
      expect(retry?.retryOf).toBe(call1);
    });
  });

  describe('execute* wrappers', () => {
    it('executeRun tracks success', async () => {
      const result = await tracker.executeRun(
        { runType: 'test', trigger: 'manual' },
        async () => 42,
      );

      expect(result).toBe(42);

      const run = await store.getRun('id_1');
      expect(run?.status).toBe('completed');
      expect(run?.output).toEqual({ result: 42 });
    });

    it('executeRun tracks failure', async () => {
      await expect(
        tracker.executeRun(
          { runType: 'test', trigger: 'manual' },
          async () => { throw new Error('boom'); },
        ),
      ).rejects.toThrow('boom');

      const run = await store.getRun('id_1');
      expect(run?.status).toBe('failed');
      expect(run?.error).toBe('boom');
    });

    it('executeStep tracks success', async () => {
      const runId = await tracker.createRun({ runType: 'test', trigger: 'manual' });

      const result = await tracker.executeStep(
        runId,
        { stepType: 'process' },
        async () => 'done',
      );

      expect(result).toBe('done');

      const step = await store.getStep('id_2');
      expect(step?.status).toBe('completed');
    });

    it('executeStep tracks failure', async () => {
      await expect(
        tracker.executeStep(null, { stepType: 'process' }, async () => {
          throw new Error('bad');
        }),
      ).rejects.toThrow('bad');

      const step = await store.getStep('id_1');
      expect(step?.status).toBe('failed');
      expect(step?.error).toBe('bad');
    });

    it('executeCall tracks success', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'fetch' });

      const result = await tracker.executeCall(
        stepId,
        { tool: 'api', operation: 'GET' },
        async () => ({ items: [1, 2] }),
      );

      expect(result).toEqual({ items: [1, 2] });

      const call = await store.getCall('id_2');
      expect(call?.status).toBe('success');
    });

    it('executeCall tracks failure', async () => {
      const stepId = await tracker.createStep(null, { stepType: 'fetch' });

      await expect(
        tracker.executeCall(stepId, { tool: 'api', operation: 'GET' }, async () => {
          throw new Error('503');
        }),
      ).rejects.toThrow('503');

      const call = await store.getCall('id_2');
      expect(call?.status).toBe('error');
      expect(call?.error).toBe('503');
    });

    it('nested execute* tracks full workflow', async () => {
      await tracker.executeRun(
        { runType: 'sync', trigger: 'cron' },
        async (runId) => {
          await tracker.executeStep(runId, { stepType: 'step_1' }, async (stepId) => {
            await tracker.executeCall(stepId, { tool: 'db', operation: 'SELECT' }, async () => {
              return [{ id: 1 }];
            });
          });
        },
      );

      expect(store.runs.size).toBe(1);
      expect(store.steps.size).toBe(1);
      expect(store.calls.size).toBe(1);

      const run = await store.getRun('id_1');
      expect(run?.status).toBe('completed');

      const step = await store.getStep('id_2');
      expect(step?.status).toBe('completed');

      const call = await store.getCall('id_3');
      expect(call?.status).toBe('success');
    });
  });
});
