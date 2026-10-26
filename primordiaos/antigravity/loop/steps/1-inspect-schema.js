import Database from "better-sqlite3";
import path from "path";

export async function step1_inspectSchema() {
  console.log(
    "?? [Step 1/6] Inspecting MoneyPlugHub database schema..."
  );

  const dbPath = path.resolve(
    "data",
    "moneyplughub.db"
  );

  const db = new Database(dbPath, {
    readonly: true
  });

  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const schema = tables.map((table) => {
    const columns = db.prepare(
      `PRAGMA table_info(${table.name})`
    ).all();

    return {
      table: table.name,
      columnCount: columns.length,
      columns: columns.map(c => ({
        name: c.name,
        type: c.type,
        notNull: !!c.notnull,
        primaryKey: !!c.pk
      }))
    };
  });

  db.close();

  return {
    status: "inspected",
    timestamp: new Date().toISOString(),
    tablesCount: schema.length,
    tables: schema
  };
}
