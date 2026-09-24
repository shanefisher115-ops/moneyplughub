import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { db, checkpointWal } from '../src/backend/db';

describe('db module', () => {
  after(() => {
    try {
      db.close();
    } catch (e) {
      // Ignored
    }
  });

  it('checkpointWal should execute successfully', () => {
    // We should test that db.exec is called and true is returned.
    const originalExec = db.exec;
    let execCalled = false;
    let execArgs: string | null = null;
    db.exec = (sql: string) => {
      execCalled = true;
      execArgs = sql;
      return null as any;
    };

    try {
      const result = checkpointWal();
      assert.strictEqual(result, true);
      assert.strictEqual(execCalled, true);
      assert.strictEqual(execArgs, 'PRAGMA wal_checkpoint(TRUNCATE);');
    } finally {
      db.exec = originalExec;
    }
  });

  it('checkpointWal should handle errors gracefully and return false', () => {
    const originalExec = db.exec;
    const originalError = console.error;
    let execCalled = false;
    let consoleErrorCalled = false;

    db.exec = (sql: string) => {
      execCalled = true;
      throw new Error('Test DB Error');
    };

    console.error = () => {
      consoleErrorCalled = true;
    };

    try {
      const result = checkpointWal();
      assert.strictEqual(result, false);
      assert.strictEqual(execCalled, true);
      assert.strictEqual(consoleErrorCalled, true);
    } finally {
      db.exec = originalExec;
      console.error = originalError;
    }
  });
});
