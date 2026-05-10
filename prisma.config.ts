import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7 CLI reads datasource URL from config.
    // Keep migrations on the direct DB connection URL.
    url: env("DIRECT_URL"),
  },
});
