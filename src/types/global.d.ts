/**
 * Déclarations de modules pour résoudre les types mal résolus (exports package.json).
 */

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
