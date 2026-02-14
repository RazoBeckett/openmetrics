import { Database } from "bun:sqlite";
import type { MessageRow, SessionRow } from "../types/index.ts";

export class OpenCodeDB {
  private db: Database;

  constructor(dbPath: string) {
    if (!Bun.file(dbPath).size) {
      throw new Error(`Database file not found: ${dbPath}`);
    }
    this.db = new Database(dbPath, { readonly: true });
  }

  validate(): { valid: boolean; error?: string } {
    try {
      const tables = this.db
        .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table'")
        .all();
      
      const tableNames = tables.map(t => t.name);
      
      if (!tableNames.includes("message")) {
        return { valid: false, error: "Missing 'message' table" };
      }
      if (!tableNames.includes("session")) {
        return { valid: false, error: "Missing 'session' table" };
      }

      const messageColumns = this.db
        .query<{ name: string }, []>("PRAGMA table_info(message)")
        .all()
        .map(c => c.name);

      const requiredMessageCols = ["id", "session_id", "data", "time_created"];
      for (const col of requiredMessageCols) {
        if (!messageColumns.includes(col)) {
          return { valid: false, error: `Missing column 'message.${col}'` };
        }
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Validation failed: ${err}` };
    }
  }

  getAllMessages(): MessageRow[] {
    return this.db
      .query<MessageRow, []>("SELECT id, session_id, time_created, time_updated, data FROM message")
      .all();
  }

  getAllSessions(): SessionRow[] {
    return this.db
      .query<SessionRow, []>("SELECT id, project_id, title, directory, time_created, time_updated FROM session")
      .all();
  }

  getSessionById(sessionId: string): SessionRow | null {
    return this.db
      .query<SessionRow, [string]>("SELECT id, project_id, title, directory, time_created, time_updated FROM session WHERE id = ?")
      .get(sessionId);
  }

  getMessagesBySessionId(sessionId: string): MessageRow[] {
    return this.db
      .query<MessageRow, [string]>("SELECT id, session_id, time_created, time_updated, data FROM message WHERE session_id = ?")
      .all(sessionId);
  }

  getMessageCountByDate(): { date: string; count: number }[] {
    return this.db
      .query<{ date: string; count: number }, []>(
        "SELECT date(time_created) as date, COUNT(*) as count FROM message GROUP BY date(time_created) ORDER BY date"
      )
      .all();
  }

  close(): void {
    this.db.close();
  }
}

export function createDatabase(dbPath: string): OpenCodeDB {
  return new OpenCodeDB(dbPath);
}
