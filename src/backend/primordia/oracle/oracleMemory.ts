import { db } from "../../db";

export interface MemoryRecord {
  node_type: string;
  content: string;
}

export class OracleMemory {

  public static getMemories(): MemoryRecord[] {

    try {

      const stmt = db.prepare(`
        SELECT
          node_type,
          content
        FROM memory_nodes
        ORDER BY created_at DESC
      `);

      return stmt.all() as unknown as MemoryRecord[];

    } catch (err) {

      console.error(
        "[OracleMemory] Failed to load memories:",
        err
      );

      return [];
    }
  }
}

