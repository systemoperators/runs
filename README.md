# @systemoperator/runs

Execution tracking for workflows, syncs, and background jobs. Zero dependencies, works everywhere (Cloudflare Workers, Node, Deno, Bun).

## install

```bash
npm install @systemoperator/runs
```

## model

3-level hierarchy that maps to any workflow pattern:

- **Run** - top-level execution (sync job, chat session, materialization, cron task)
- **Step** - individual operation within a run (fetch data, process batch, upload file)
- **Call** - atomic tool/API invocation within a step (HTTP request, DB query, LLM call)

runs contain steps, steps contain calls. steps can nest via `parentStepId`.

## usage

### 1. implement RunStore

the package doesn't touch your database. you implement 9 methods (insert/get/update for each entity):

```typescript
import type { RunStore, Run, Step, Call } from '@systemoperator/runs';

const store: RunStore = {
  async insertRun(run: Run) {
    await db.insert(runs).values({
      id: run.id,
      runType: run.runType,
      trigger: run.trigger,
      // ... map all fields to your schema
    });
  },
  async getRun(id: string) {
    const row = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!row[0]) return null;
    return { /* map row to Run */ };
  },
  async updateRun(id: string, fields: Partial<Run>) {
    await db.update(runs).set(fields).where(eq(runs.id, id));
  },
  // same pattern for insertStep, getStep, updateStep,
  // insertCall, getCall, updateCall
};
```

### 2. create tracker

```typescript
import { RunTracker } from '@systemoperator/runs';

const tracker = new RunTracker({
  store: myStore,
  generateId: () => generateId(), // your ID generator (ULID, UUID, etc.)
});
```

### 3. track execution

manual lifecycle:

```typescript
const runId = await tracker.createRun({
  runType: 'sync_stripe',
  trigger: 'cron',
});
await tracker.startRun(runId);

const stepId = await tracker.createStep(runId, {
  stepType: 'fetch_charges',
});
await tracker.startStep(stepId);

const callId = await tracker.createCall(stepId, {
  tool: 'stripe_api',
  operation: 'GET /charges',
});
// ... do the work ...
await tracker.finishCall(callId, { output: { count: 100 } });

await tracker.finishStep(stepId, { output: { fetched: 100 } });
await tracker.finishRun(runId, { output: { total: 100 } });
```

or use convenience wrappers:

```typescript
await tracker.executeRun(
  { runType: 'sync_stripe', trigger: 'cron' },
  async (runId) => {
    await tracker.executeStep(runId, { stepType: 'fetch_charges' }, async (stepId) => {
      const charges = await tracker.executeCall(
        stepId,
        { tool: 'stripe_api', operation: 'GET /charges' },
        () => stripe.charges.list(),
      );
      return charges;
    });
  },
);
```

### batch progress

```typescript
await tracker.updateStepProgress(stepId, {
  itemsTotal: 500,
  itemsProcessed: 150,
  itemsSucceeded: 148,
  itemsFailed: 2,
});
```

### run output counters

```typescript
await tracker.incrementRunOutput(runId, {
  fetched: 50,
  inserted: 30,
  updated: 15,
  unchanged: 5,
});
```

## helpers

```typescript
import {
  isRunComplete,
  isStepComplete,
  isCallComplete,
  getRunSummary,
  formatDuration,
  mergeOutputIncrements,
} from '@systemoperator/runs';
```

## owner fields

the package deliberately does NOT include owner fields (userId, spaceId, orgId). add these to your schema and inject via store closure:

```typescript
function createStore(spaceId: string): RunStore {
  return {
    async insertRun(run) {
      await db.insert(runs).values({ ...run, spaceId });
    },
    // ...
  };
}
```

## license

MIT
