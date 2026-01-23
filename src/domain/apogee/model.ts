export type ApogeeTone = "gold" | "cobalt" | "emerald" | "graphite" | "crimson";

export type SignalSeverity = "CRITICAL" | "HIGH" | "ELEVATED" | "GUARDED" | "CLEAR";
export type SignalMomentum = "UP" | "STABLE" | "DOWN";
export type SignalDomain =
  | "ATTENDANCE"
  | "FINANCE"
  | "ACADEMICS"
  | "ENGAGEMENT"
  | "LIBRARY"
  | "SYSTEM";

export interface Signal {
  readonly id: string;
  readonly domain: SignalDomain;
  readonly label: string;
  readonly severity: SignalSeverity;
  readonly score: number;
  readonly momentum: SignalMomentum;
  readonly hint: string;
  readonly tone: ApogeeTone;
}

export interface TelemetryLog {
  readonly id: string;
  readonly timestamp: string;
  readonly scope: SignalDomain;
  readonly message: string;
  readonly context: Record<string, string | number | boolean>;
}

export interface ApogeeMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone: ApogeeTone;
  readonly delta?: string;
}

export interface PerformanceBand {
  readonly grade: string;
  readonly count: number;
  readonly intensity: number;
  readonly tone: ApogeeTone;
}

export interface ActivityEntry {
  readonly action: string;
  readonly entity: string;
  readonly user: string;
  readonly time: string;
}

export interface ActivityPulse {
  readonly items: ActivityEntry[];
  readonly tempo: number;
  readonly freshness: number;
}

export interface ApogeeQueueSnapshot {
  readonly primary: Signal[];
  readonly backlog: Signal[];
}

export interface ApogeeDashboardModel {
  readonly narrative: {
    readonly headline: string;
    readonly subline: string;
  };
  readonly metrics: ApogeeMetric[];
  readonly signals: Signal[];
  readonly queue: ApogeeQueueSnapshot;
  readonly performance: PerformanceBand[];
  readonly activity: ActivityPulse;
  readonly logbook: TelemetryLog[];
}
