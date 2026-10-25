import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireAdmin, AuthenticatedRequest } from '../auth';
import { Response, NextFunction } from 'express';

describe('requireAdmin middleware', () => {
  it('should return 403 if req.user is undefined', () => {
    const req = {} as AuthenticatedRequest;

    let statusCalledWith: number | undefined;
    let jsonCalledWith: any;
    const res = {
      status: (code: number) => {
        statusCalledWith = code;
        return {
          json: (data: any) => {
            jsonCalledWith = data;
          }
        };
      }
    } as Response;

    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    requireAdmin(req, res, next);

    assert.strictEqual(statusCalledWith, 403);
    assert.deepStrictEqual(jsonCalledWith, { success: false, error: 'Access denied: Admin authorization required.' });
    assert.strictEqual(nextCalled, false);
  });

  it('should return 403 if req.user.role is not admin', () => {
    const req = {
      user: { role: 'user' }
    } as AuthenticatedRequest;

    let statusCalledWith: number | undefined;
    let jsonCalledWith: any;
    const res = {
      status: (code: number) => {
        statusCalledWith = code;
        return {
          json: (data: any) => {
            jsonCalledWith = data;
          }
        };
      }
    } as Response;

    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    requireAdmin(req, res, next);

    assert.strictEqual(statusCalledWith, 403);
    assert.deepStrictEqual(jsonCalledWith, { success: false, error: 'Access denied: Admin authorization required.' });
    assert.strictEqual(nextCalled, false);
  });

  it('should call next() if req.user.role is admin', () => {
    const req = {
      user: { role: 'admin' }
    } as AuthenticatedRequest;

    let statusCalled = false;
    const res = {
      status: (code: number) => {
        statusCalled = true;
        return {
          json: (data: any) => {}
        };
      }
    } as Response;

    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    requireAdmin(req, res, next);

    assert.strictEqual(statusCalled, false);
    assert.strictEqual(nextCalled, true);
  });
});
