import pino from "pino";

export interface CreateLoggerOptions {
  name: string;
  level?: string;
  pretty?: boolean;
}

export function createLogger(options: CreateLoggerOptions) {
  const { name, level = process.env.LOG_LEVEL ?? "info", pretty = process.env.NODE_ENV !== "production" } = options;

  return pino({
    name,
    level,
    transport: pretty ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss.l" } } : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
