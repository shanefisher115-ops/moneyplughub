import { db } from "../../db";

const rows = db.prepare(`
  SELECT id,email
  FROM users
  LIMIT 10
`).all();

console.log(rows);
