/**
 * server/db/index.ts — Drizzle + Postgres connection
 * Uses @neondatabase/serverless for Railway Postgres compatibility.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../shared/schema.js";

const DATABASE_URL = process.env.CLAYTARA_COMMAND_DATABASE_URL ?? process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("[db] CLAYTARA_COMMAND_DATABASE_URL or DATABASE_URL is required but not set.");
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

export const db = drizzle(sql, { schema });

export default db;
