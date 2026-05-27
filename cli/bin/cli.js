#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";

const API_BASE = "https://codeautopsy-lyart.vercel.app";

const GRADE_COLORS = {
  A: chalk.green,
  B: chalk.cyan,
  C: chalk.yellow,
  D: chalk.red,
  F: chalk.bgRed.white,
};

const ROLE_BADGES = {
  entry:  chalk.bgBlue.white(" ENTRY  "),
  config: chalk.bgGray.white(" CONFIG "),
  core:   chalk.bgMagenta.white("  CORE  "),
};

/*
function getApiKey() {
  const key = process.env.CODEAUTOPSY_API_KEY;
  if (!key) {
    console.error(
      chalk.red.bold("\n  ✖ Missing API key.\n") +
      chalk.dim("  Set it with: ") +
      chalk.cyan("export CODEAUTOPSY_API_KEY=your_key_here") +
      chalk.dim("\n  Get a key at: ") +
      chalk.cyan("https://codeautopsy.dev/dashboard\n"),
    );
    process.exit(1);
  }
  return key;
}
*/

function printHeader() {
  console.log(
    "\n" +
    chalk.white.bold("  ╔══════════════════════════════╗\n") +
    chalk.white.bold("  ║   ") + chalk.cyan.bold("CodeAutopsy") + chalk.white.dim("  AST Analyzer") + chalk.white.bold("  ║\n") +
    chalk.white.bold("  ╚══════════════════════════════╝") +
    "\n",
  );
}

function printHealthMetrics(meta, healthMetrics) {
  const grade       = healthMetrics.grade ?? "?";
  const score       = healthMetrics.score ?? 0;
  const status      = healthMetrics.status ?? "Unknown";
  const colorize    = GRADE_COLORS[grade] ?? chalk.white;

  console.log(chalk.bold("  Repository"));
  console.log(chalk.dim("  ─────────────────────────────────────────"));
  console.log(`  ${chalk.dim("Owner  ")}  ${chalk.white.bold(`${meta.owner}/${meta.name}`)}`);
  console.log(`  ${chalk.dim("Branch ")}  ${chalk.white(meta.branch)}`);
  console.log(`  ${chalk.dim("Stars  ")}  ${chalk.yellow("★")} ${chalk.white(meta.stars.toLocaleString())}`);
  console.log(`  ${chalk.dim("Nodes  ")}  ${chalk.white(meta.nodeCount)} files · ${chalk.white(meta.edgeCount)} edges`);
  console.log(`  ${chalk.dim("Cached ")}  ${meta.cached ? chalk.green("yes") : chalk.dim("no")}`);

  console.log("\n" + chalk.bold("  Health Score"));
  console.log(chalk.dim("  ─────────────────────────────────────────"));
  console.log(`  ${colorize.bold(`  ${grade}  `)}  ${colorize.bold(`${score}/100`)}  ${chalk.dim(status)}`);
}

function printTopFiles(topFiles) {
  const top3 = topFiles.slice(0, 3);

  console.log("\n" + chalk.bold("  Top Files"));
  console.log(chalk.dim("  ─────────────────────────────────────────"));

  top3.forEach((file, i) => {
    const badge = ROLE_BADGES[file.role] ?? chalk.bgGray.white(` ${file.role} `);
    const index = chalk.dim(`  ${i + 1}.`);
    console.log(`${index} ${badge} ${chalk.white(file.path)}`);
  });
}

function printFooter(analyzedAt) {
  console.log(
    "\n" +
    chalk.dim(`  Analyzed at ${new Date(analyzedAt).toLocaleString()}`) +
    "\n",
  );
}

function handleApiError(status, body) {
  const message = body?.error ?? body?.message ?? "An unknown error occurred.";

  const STATUS_MESSAGES = {
    401: chalk.red.bold("  ✖ Unauthorized — ") + chalk.white("Invalid or missing Authorization header."),
    403: chalk.red.bold("  ✖ Forbidden — ")    + chalk.white(message),
    422: chalk.red.bold("  ✖ Unprocessable — ") + chalk.white(message),
    429: chalk.yellow.bold("  ✖ Rate limited — ") + chalk.white(message) +
         (body?.retryAfter ? chalk.dim(`\n  Retry after ${body.retryAfter}s.`) : ""),
    500: chalk.red.bold("  ✖ Server error — ") + chalk.white(message),
    503: chalk.red.bold("  ✖ Service unavailable — ") + chalk.white(message),
  };

  console.error("\n" + (STATUS_MESSAGES[status] ?? chalk.red.bold(`  ✖ HTTP ${status} — `) + chalk.white(message)) + "\n");
  process.exit(1);
}

async function analyzeRepo(repoUrl) {
  // const apiKey = getApiKey();

  printHeader();

  const spinner = ora({
    text:  chalk.dim(`  Analyzing ${repoUrl} …`),
    color: "cyan",
    indent: 2,
  }).start();

  let response;
  try {
    response = await fetch(`${API_BASE}/api/v1/analyze`, {
      method: "POST",
      headers: {
        // "Authorization":  `Bearer ${apiKey}`,
        "Content-Type":   "application/json",
      },
      body: JSON.stringify({ repoUrl }),
    });
  } catch (err) {
    spinner.fail(chalk.red("  Network error — could not reach the CodeAutopsy API."));
    console.error(chalk.dim(`\n  ${err.message}\n`));
    process.exit(1);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    spinner.fail(chalk.red("  Failed to parse API response."));
    process.exit(1);
  }

  if (!response.ok) {
    spinner.fail(chalk.red(`  Request failed with status ${response.status}.`));
    handleApiError(response.status, body);
  }

  spinner.succeed(chalk.green("  Analysis complete."));
  console.log();

  printHealthMetrics(body.meta, body.graph.healthMetrics);
  printTopFiles(body.graph.topFiles);
  printFooter(body.meta.analyzedAt);
}

program
  .name("codeautopsy")
  .description("AST-based dependency analysis for GitHub repositories.")
  .version("1.0.0");

program
  .command("analyze <url>")
  .description("Analyze a public GitHub repository.")
  .action(analyzeRepo);

program.parse();