/**
 * Déclarations de modules pour résoudre les types mal résolus (exports package.json).
 */

/// <reference types="@react-three/fiber" />

declare module "date-fns" {
  export function format(date: Date | number, formatStr: string, options?: unknown): string;
  export function addDays(date: Date | number, amount: number): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function startOfWeek(date: Date | number, options?: unknown): Date;
  export function endOfWeek(date: Date | number, options?: unknown): Date;
  export function eachDayOfInterval(interval: { start: Date; end: Date }): Date[];
  export function isSameDay(left: Date | number, right: Date | number): boolean;
  export function isToday(date: Date | number): boolean;
  export const enUS: unknown;
}

declare module "date-fns/locale" {
  export const fr: { code: string; formatLong?: unknown; localize?: unknown; match?: unknown; options?: unknown };
  export const enUS: unknown;
}

declare module "swagger-jsdoc" {
  namespace swaggerJsdoc {
    interface Options {
      definition: Record<string, unknown>;
      apis?: string[];
    }
  }
  function swaggerJsdoc(options: swaggerJsdoc.Options): unknown[];
  export = swaggerJsdoc;
}

declare module "@sentry/nextjs" {
  export type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";
  export function init(options: Record<string, unknown>): void;
  export const browserTracingIntegration: () => unknown;
  export const replayIntegration: (options?: Record<string, unknown>) => unknown;
  export function captureException(error: unknown, captureContext?: Record<string, unknown>): string | undefined;
  export function captureMessage(message: string, captureContext?: Record<string, unknown>): string | undefined;
  export function setUser(user: { id?: string; email?: string; role?: string } | null): void;
  export function addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  export function startSpan(options: Record<string, unknown>): unknown;
  export const metrics: { distribution: (name: string, value: number, opts?: Record<string, unknown>) => void };
}
