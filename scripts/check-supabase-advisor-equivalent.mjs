import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;
const SPLINTER_SQL_URL =
  "https://raw.githubusercontent.com/supabase/splinter/main/splinter.sql";

async function ensureSplinterSqlFile(sqlPath) {
  try {
    await fs.access(sqlPath);
    return;
  } catch {}

  const response = await fetch(SPLINTER_SQL_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download splinter.sql (${response.status} ${response.statusText})`,
    );
  }
  const sql = await response.text();
  await fs.mkdir(path.dirname(sqlPath), { recursive: true });
  await fs.writeFile(sqlPath, sql, "utf8");
}

function buildLintQuery(rawSql) {
  const lines = rawSql.split(/\r?\n/);
  return lines
    .filter((line) => !line.toLowerCase().includes("set local search_path"))
    .join("\n")
    .trim();
}

function summarize(rows) {
  const counts = rows.reduce((acc, row) => {
    const level = String(row.level || "INFO").toUpperCase();
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  const issues = rows
    .filter((row) => {
      const level = String(row.level || "").toUpperCase();
      return level === "ERROR" || level === "WARN";
    })
    .map((row) => ({
      name: row.name,
      level: row.level,
      title: row.title,
      detail: row.detail,
    }));

  return { counts, issues };
}

async function main() {
  const prismaConnectionString =
    process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!prismaConnectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL is required");
  }

  const sqlPath = path.resolve(".tmp", "splinter.sql");
  await ensureSplinterSqlFile(sqlPath);
  const rawSql = await fs.readFile(sqlPath, "utf8");
  const lintQuery = buildLintQuery(rawSql);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: prismaConnectionString }),
  });

  try {
    // Match Splinter's hardening intent while avoiding SET LOCAL transaction scope.
    await prisma.$executeRawUnsafe("set search_path = '';");
    const rows = await prisma.$queryRawUnsafe(lintQuery);
    const { counts, issues } = summarize(rows);

    console.log("SPLINTER_ROWS", rows.length);
    console.log("SPLINTER_COUNTS", counts);
    if (issues.length > 0) {
      console.log("SPLINTER_ISSUES", JSON.stringify(issues, null, 2));
      process.exitCode = 1;
      return;
    }

    console.log("SPLINTER_STATUS", "PASS_NO_WARN_OR_ERROR");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
