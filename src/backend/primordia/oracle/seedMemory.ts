import { db } from "../../db";

db.prepare(`
  INSERT OR REPLACE INTO memory_nodes (
    id,
    user_id,
    node_type,
    title,
    content,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  "goal_primordia",
  "usr_admin_001",
  "goal",
  "Primary Goal",
  "Build PrimordiaOS",
  new Date().toISOString()
);

console.log("? Primordia goal memory inserted");

