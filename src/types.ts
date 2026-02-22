/**
 * Types for @systemoperator/runs
 *
 * 3-level execution tracking: Run > Step > Call
 */

// --- Status types ---

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type CallStatus = 'pending' | 'running' | 'success' | 'error';

// --- Classification types ---

export type TriggerType = 'cron' | 'user' | 'webhook' | 'chat' | 'agent' | 'manual' | 'system';
export type ActorType = 'user' | 'agent' | 'system';

// --- Core records ---

/** Top-level execution container (sync job, chat session, materialization, etc.) */
export interface Run {
  id: string;
  runType: string;
  trigger: TriggerType;
  actorType: ActorType;
  actorId: string | null;
  status: RunStatus;
  currentStep: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Individual operation within a run */
export interface Step {
  id: string;
  runId: string | null;
  parentStepId: string | null;
  stepIndex: number;
  actorType: ActorType;
  actorId: string | null;
  stepType: string;
  status: StepStatus;
  entityType: string | null;
  entityId: string | null;
  context: Record<string, any> | null;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  itemsTotal: number | null;
  itemsProcessed: number | null;
  itemsSucceeded: number | null;
  itemsFailed: number | null;
  attempt: number;
  retryOf: string | null;
  maxRetries: number | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Atomic tool/API invocation within a step */
export interface Call {
  id: string;
  stepId: string;
  tool: string;
  operation: string;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  status: CallStatus;
  error: string | null;
  attempt: number;
  retryOf: string | null;
  durationMs: number | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

// --- Store interface ---

/** User implements this to provide persistence */
export interface RunStore {
  insertRun(run: Run): Promise<void>;
  getRun(id: string): Promise<Run | null>;
  updateRun(id: string, fields: Partial<Run>): Promise<void>;

  insertStep(step: Step): Promise<void>;
  getStep(id: string): Promise<Step | null>;
  updateStep(id: string, fields: Partial<Step>): Promise<void>;

  insertCall(call: Call): Promise<void>;
  getCall(id: string): Promise<Call | null>;
  updateCall(id: string, fields: Partial<Call>): Promise<void>;
}

// --- Config ---

export interface RunTrackerConfig {
  store: RunStore;
  generateId: () => string;
  linkStore?: StepLinkStore;
}

// --- Params for creating records ---

export interface CreateRunParams {
  runType: string;
  trigger: TriggerType;
  actorType?: ActorType;
  actorId?: string | null;
  input?: Record<string, any> | null;
}

export interface CreateStepParams {
  stepType: string;
  actorType?: ActorType;
  actorId?: string | null;
  stepIndex?: number;
  parentStepId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  context?: Record<string, any> | null;
  input?: Record<string, any> | null;
  maxRetries?: number | null;
}

export interface CreateCallParams {
  tool: string;
  operation: string;
  input?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  retryOf?: string | null;
}

// --- Params for finishing records ---

export interface FinishRunParams {
  output?: Record<string, any> | null;
}

export interface FinishStepParams {
  output?: Record<string, any> | null;
}

export interface FinishCallParams {
  output?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

/** Progress update for batch steps */
export interface StepProgress {
  itemsTotal?: number;
  itemsProcessed?: number;
  itemsSucceeded?: number;
  itemsFailed?: number;
}

/** Increment deltas for run output counters */
export type OutputIncrements = Record<string, number>;

// --- Step Links (optional extension) ---

export type StepLinkType = 'input' | 'output' | 'affected';

/** A many-to-many link between a step and an entity it touched */
export interface StepLink {
  id: string;
  stepId: string;
  linkType: StepLinkType;
  entityType: string;
  entityId: string;
  externalId: string | null;
  createdAt: Date;
}

/** Params for creating a step link */
export interface CreateStepLinkParams {
  linkType: StepLinkType;
  entityType: string;
  entityId: string;
  externalId?: string | null;
}

/** Optional store for step links - separate from RunStore so existing implementations don't break */
export interface StepLinkStore {
  insertStepLink(link: StepLink): Promise<void>;
  getStepLinks(stepId: string): Promise<StepLink[]>;
}
