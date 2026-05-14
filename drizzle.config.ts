import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.CLAYTARA_COMMAND_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
