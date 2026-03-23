type DateLike = Date | string | null | undefined;

type PeriodLike = {
  sequence?: number | null;
};

type AnalyticsLike = {
  studentId: string;
  period?: PeriodLike | null;
  analyzedAt?: DateLike;
  createdAt?: DateLike;
};

function toTimestamp(value: DateLike): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareAnalyticsRecency<T extends AnalyticsLike>(left: T, right: T): number {
  const sequenceDelta = (left.period?.sequence ?? -1) - (right.period?.sequence ?? -1);
  if (sequenceDelta !== 0) return sequenceDelta;

  const analyzedAtDelta = toTimestamp(left.analyzedAt) - toTimestamp(right.analyzedAt);
  if (analyzedAtDelta !== 0) return analyzedAtDelta;

  return toTimestamp(left.createdAt) - toTimestamp(right.createdAt);
}

export function dedupeLatestAnalyticsByStudent<T extends AnalyticsLike>(items: T[]): T[] {
  const latestByStudent = new Map<string, T>();

  for (const item of items) {
    const current = latestByStudent.get(item.studentId);
    if (!current || compareAnalyticsRecency(item, current) > 0) {
      latestByStudent.set(item.studentId, item);
    }
  }

  return Array.from(latestByStudent.values()).sort((left, right) => {
    const recencyDelta = compareAnalyticsRecency(right, left);
    if (recencyDelta !== 0) return recencyDelta;
    return left.studentId.localeCompare(right.studentId);
  });
}

export function averageNumbers(values: Array<number | null | undefined>): number | null {
  const validValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (validValues.length === 0) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

export function roundTo(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeGradeTo20(
  value: number | null | undefined,
  maxGrade: number | null | undefined
): number | null {
  if (
    value === null ||
    value === undefined ||
    maxGrade === null ||
    maxGrade === undefined ||
    !Number.isFinite(value) ||
    !Number.isFinite(maxGrade) ||
    maxGrade <= 0
  ) {
    return null;
  }

  return (value / maxGrade) * 20;
}
