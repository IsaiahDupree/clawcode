import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export const log = {
  debug: (msg: string, ...args: unknown[]) => {
    if (shouldLog("debug")) console.debug(chalk.gray(`[debug] ${msg}`), ...args);
  },
  info: (msg: string, ...args: unknown[]) => {
    if (shouldLog("info")) console.log(chalk.blue(`[info] ${msg}`), ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (shouldLog("warn")) console.warn(chalk.yellow(`[warn] ${msg}`), ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    if (shouldLog("error")) console.error(chalk.red(`[error] ${msg}`), ...args);
  },
};
