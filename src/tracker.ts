/**
 * RunTracker - main entry point for @systemoperator/runs
 *
 * Wraps a RunStore with lifecycle management, duration tracking,
 * progress updates, and execute* convenience methods.
 */

import type {
  RunStore,
  StepLinkStore,
  RunTrackerConfig,
  Run,
  Step,
  Call,
  StepLink,
  CreateRunParams,
  CreateStepParams,
  CreateCallParams,
  CreateStepLinkParams,
  FinishRunParams,
  FinishStepParams,
  FinishCallParams,
  StepProgress,
  OutputIncrements,
} from './types';
import { calculateDuration, mergeOutputIncrements } from './helpers';

export class RunTracker {
  private store: RunStore;
  private generateId: () => string;
  private linkStore: StepLinkStore | null;

  constructor(config: RunTrackerConfig) {
    this.store = config.store;
    this.generateId = config.generateId;
    this.linkStore = config.linkStore ?? null;
  }

  // --- Runs ---

  /** Create a new run in pending state */
  async createRun(params: CreateRunParams): Promise<string> {
    const now = new Date();
    const id = this.generateId();

    const run: Run = {
      id,
      runType: params.runType,
      trigger: params.trigger,
      actorType: params.actorType ?? 'system',
      actorId: params.actorId ?? null,
      status: 'pending',
      currentStep: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      input: params.input ?? null,
      output: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.insertRun(run);
    return id;
  }

  /** Mark a run as running */
  async startRun(runId: string): Promise<void> {
    const now = new Date();
    await this.store.updateRun(runId, {
      status: 'running',
      startedAt: now,
      updatedAt: now,
    });
  }

  /** Mark a run as completed */
  async finishRun(runId: string, params?: FinishRunParams): Promise<void> {
    const now = new Date();
    const run = await this.store.getRun(runId);

    await this.store.updateRun(runId, {
      status: 'completed',
      completedAt: now,
      durationMs: calculateDuration(run?.startedAt ?? null, now),
      output: params?.output ?? run?.output ?? null,
      currentStep: null,
      updatedAt: now,
    });
  }

  /** Mark a run as failed */
  async failRun(runId: string, error: string | Error): Promise<void> {
    const now = new Date();
    const run = await this.store.getRun(runId);

    await this.store.updateRun(runId, {
      status: 'failed',
      completedAt: now,
      durationMs: calculateDuration(run?.startedAt ?? null, now),
      error: error instanceof Error ? error.message : error,
      currentStep: null,
      updatedAt: now,
    });
  }

  /** Increment counters in run output (fetched +10, inserted +5, etc.) */
  async incrementRunOutput(runId: string, increments: OutputIncrements): Promise<void> {
    const run = await this.store.getRun(runId);
    const merged = mergeOutputIncrements(run?.output ?? null, increments);

    await this.store.updateRun(runId, {
      output: merged,
      updatedAt: new Date(),
    });
  }

  /** Update run's currentStep label */
  async updateRunProgress(runId: string, currentStep: string): Promise<void> {
    await this.store.updateRun(runId, {
      currentStep,
      updatedAt: new Date(),
    });
  }

  // --- Steps ---

  /** Create a step within a run (or standalone if runId is null) */
  async createStep(runId: string | null, params: CreateStepParams): Promise<string> {
    const now = new Date();
    const id = this.generateId();

    const step: Step = {
      id,
      runId,
      parentStepId: params.parentStepId ?? null,
      stepIndex: params.stepIndex ?? 0,
      actorType: params.actorType ?? 'system',
      actorId: params.actorId ?? null,
      stepType: params.stepType,
      status: 'pending',
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      context: params.context ?? null,
      input: params.input ?? null,
      output: null,
      itemsTotal: null,
      itemsProcessed: null,
      itemsSucceeded: null,
      itemsFailed: null,
      attempt: 1,
      retryOf: null,
      maxRetries: params.maxRetries ?? null,
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.insertStep(step);
    return id;
  }

  /** Mark a step as running, update parent run's currentStep */
  async startStep(stepId: string): Promise<void> {
    const now = new Date();
    const step = await this.store.getStep(stepId);

    await this.store.updateStep(stepId, {
      status: 'running',
      startedAt: now,
      updatedAt: now,
    });

    if (step?.runId) {
      await this.store.updateRun(step.runId, {
        currentStep: step.stepType,
        updatedAt: now,
      });
    }
  }

  /** Mark a step as completed */
  async finishStep(stepId: string, params?: FinishStepParams): Promise<void> {
    const now = new Date();
    const step = await this.store.getStep(stepId);

    await this.store.updateStep(stepId, {
      status: 'completed',
      completedAt: now,
      durationMs: calculateDuration(step?.startedAt ?? null, now),
      output: params?.output ?? step?.output ?? null,
      updatedAt: now,
    });
  }

  /** Mark a step as failed */
  async failStep(stepId: string, error: string | Error): Promise<void> {
    const now = new Date();
    const step = await this.store.getStep(stepId);

    await this.store.updateStep(stepId, {
      status: 'failed',
      completedAt: now,
      durationMs: calculateDuration(step?.startedAt ?? null, now),
      error: error instanceof Error ? error.message : error,
      updatedAt: now,
    });
  }

  /** Mark a step as skipped */
  async skipStep(stepId: string, reason?: string): Promise<void> {
    const now = new Date();
    await this.store.updateStep(stepId, {
      status: 'skipped',
      completedAt: now,
      output: reason ? { reason } : null,
      updatedAt: now,
    });
  }

  /** Update batch progress on a step */
  async updateStepProgress(stepId: string, progress: StepProgress): Promise<void> {
    const fields: Partial<Step> = { updatedAt: new Date() };
    if (progress.itemsTotal !== undefined) fields.itemsTotal = progress.itemsTotal;
    if (progress.itemsProcessed !== undefined) fields.itemsProcessed = progress.itemsProcessed;
    if (progress.itemsSucceeded !== undefined) fields.itemsSucceeded = progress.itemsSucceeded;
    if (progress.itemsFailed !== undefined) fields.itemsFailed = progress.itemsFailed;

    await this.store.updateStep(stepId, fields);
  }

  // --- Calls ---

  /** Create a call within a step */
  async createCall(stepId: string, params: CreateCallParams): Promise<string> {
    const now = new Date();
    const id = this.generateId();

    let attempt = 1;
    if (params.retryOf) {
      const prev = await this.store.getCall(params.retryOf);
      attempt = (prev?.attempt ?? 0) + 1;
    }

    const call: Call = {
      id,
      stepId,
      tool: params.tool,
      operation: params.operation,
      input: params.input ?? null,
      output: null,
      status: 'running',
      error: null,
      attempt,
      retryOf: params.retryOf ?? null,
      durationMs: null,
      metadata: params.metadata ?? null,
      createdAt: now,
    };

    await this.store.insertCall(call);
    return id;
  }

  /** Mark a call as success */
  async finishCall(callId: string, params?: FinishCallParams): Promise<void> {
    const call = await this.store.getCall(callId);

    await this.store.updateCall(callId, {
      status: 'success',
      output: params?.output ?? null,
      durationMs: calculateDuration(call?.createdAt ?? null),
      metadata: params?.metadata ?? call?.metadata ?? null,
    });
  }

  /** Mark a call as error */
  async failCall(callId: string, error: string | Error): Promise<void> {
    const call = await this.store.getCall(callId);

    await this.store.updateCall(callId, {
      status: 'error',
      error: error instanceof Error ? error.message : error,
      durationMs: calculateDuration(call?.createdAt ?? null),
    });
  }

  // --- Step Links (optional) ---

  /** Link a step to an entity. Returns link ID, or null if no linkStore configured. */
  async linkStep(stepId: string, params: CreateStepLinkParams): Promise<string | null> {
    if (!this.linkStore) return null;

    const link: StepLink = {
      id: this.generateId(),
      stepId,
      linkType: params.linkType,
      entityType: params.entityType,
      entityId: params.entityId,
      externalId: params.externalId ?? null,
      createdAt: new Date(),
    };

    await this.linkStore.insertStepLink(link);
    return link.id;
  }

  /** Get all links for a step. Returns [] if no linkStore configured. */
  async getStepLinks(stepId: string): Promise<StepLink[]> {
    if (!this.linkStore) return [];
    return this.linkStore.getStepLinks(stepId);
  }

  // --- Convenience: execute with automatic lifecycle tracking ---

  /** Execute a function as a tracked run */
  async executeRun<T>(
    params: CreateRunParams,
    fn: (runId: string) => Promise<T>,
  ): Promise<T> {
    const runId = await this.createRun(params);
    await this.startRun(runId);

    try {
      const result = await fn(runId);
      await this.finishRun(runId, { output: result != null ? { result } : null });
      return result;
    } catch (error) {
      await this.failRun(runId, error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /** Execute a function as a tracked step within a run */
  async executeStep<T>(
    runId: string | null,
    params: CreateStepParams,
    fn: (stepId: string) => Promise<T>,
  ): Promise<T> {
    const stepId = await this.createStep(runId, params);
    await this.startStep(stepId);

    try {
      const result = await fn(stepId);
      await this.finishStep(stepId, { output: result != null ? { result } : null });
      return result;
    } catch (error) {
      await this.failStep(stepId, error instanceof Error ? error : String(error));
      throw error;
    }
  }

  /** Execute a function as a tracked call within a step */
  async executeCall<T>(
    stepId: string,
    params: CreateCallParams,
    fn: () => Promise<T>,
  ): Promise<T> {
    const callId = await this.createCall(stepId, params);

    try {
      const result = await fn();
      await this.finishCall(callId, { output: result != null ? { result } : null });
      return result;
    } catch (error) {
      await this.failCall(callId, error instanceof Error ? error : String(error));
      throw error;
    }
  }
}
