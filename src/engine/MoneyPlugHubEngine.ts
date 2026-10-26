import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface TaskPayload {
  target: string;
  action: string;
  data: Record<string, any>;
  depth?: number;
}

export interface TaskResult {
  taskId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | 'QUARANTINED';
  output?: any;
  error?: string;
  attempts: number;
  depth: number;
}

export class MoneyPlugHubEngine {
  private static readonly MAX_DEPTH = 12;
  private static readonly MAX_RETRIES = 3;
  private traceDir = path.resolve(process.cwd(), 'traces');
  private quarantineDir = path.join(this.traceDir, 'quarantine');
  private cache = new Map<string, TaskResult>();

  constructor() {
    if (!fs.existsSync(this.traceDir)) fs.mkdirSync(this.traceDir, { recursive: true });
    if (!fs.existsSync(this.quarantineDir)) fs.mkdirSync(this.quarantineDir, { recursive: true });
  }

  private computeIdempotencyKey(payload: TaskPayload): string {
    const raw = `${payload.target}:${payload.action}:${JSON.stringify(payload.data)}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public async executeTask(payload: TaskPayload): Promise<TaskResult> {
    const depth = payload.depth || 0;
    const taskId = crypto.randomUUID();

    // Enforce Loop Depth Ceiling = 12
    if (depth > MoneyPlugHubEngine.MAX_DEPTH) {
      const result: TaskResult = {
        taskId,
        status: 'QUARANTINED',
        error: `Loop depth ceiling exceeded (${depth} > ${MoneyPlugHubEngine.MAX_DEPTH})`,
        attempts: 0,
        depth
      };
      this.flushTrace(taskId, result);
      fs.writeFileSync(path.join(this.quarantineDir, `${taskId}.json`), JSON.stringify(result, null, 2));
      return result;
    }

    // Check Idempotency Cache / SHA-256 State Hash
    const stateHash = this.computeIdempotencyKey(payload);
    if (this.cache.has(stateHash)) {
      return this.cache.get(stateHash)!;
    }

    // Execute with Retry Budget = 3
    let attempts = 0;
    let lastError: string = '';

    while (attempts < MoneyPlugHubEngine.MAX_RETRIES) {
      attempts++;
      try {
        const output = await this.dispatchToAdapters(payload);
        const result: TaskResult = { taskId, status: 'SUCCESS', output, attempts, depth };
        this.cache.set(stateHash, result);
        this.flushTrace(taskId, result);
        return result;
      } catch (err: any) {
        lastError = err.message || 'Unknown execution error';
        const backoff = 500 * Math.pow(2, attempts - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    const failedResult: TaskResult = {
      taskId,
      status: 'QUARANTINED',
      error: `Retry budget exhausted. Last error: ${lastError}`,
      attempts,
      depth
    };
    this.flushTrace(taskId, failedResult);
    fs.writeFileSync(path.join(this.quarantineDir, `${taskId}.json`), JSON.stringify(failedResult, null, 2));
    return failedResult;
  }

  private async dispatchToAdapters(payload: TaskPayload): Promise<any> {
    return { acknowledged: true, target: payload.target, action: payload.action };
  }

  private flushTrace(taskId: string, result: TaskResult) {
    const tracePath = path.join(this.traceDir, `${taskId}.json`);
    fs.writeFileSync(tracePath, JSON.stringify({ timestamp: new Date().toISOString(), ...result }, null, 2));
  }
}
