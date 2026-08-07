export interface Exercise {
  name: string;
  volume: string;
  description?: string;
  rest?: string;
  science?: string;
  tip?: string;
  isKey?: boolean;
  keyBadge?: string;
  loggable?: boolean;
  sets?: number;
}

export interface Section {
  title: string;
  badge: string;
  badgeStyle: string;
  note?: string;
  exercises: Exercise[];
}

export interface DaySummary {
  warmup: number;
  main: number;
  cooldown?: number;
  metabolic?: number;
  total: number;
}

export interface WorkoutDay {
  id: string;
  name: string;
  subtitle: string;
  tag: string;
  summary: DaySummary;
  sections: Section[];
}

export interface WeeklyScheduleItem {
  day: string;
  session: string;
  name: string;
  color: string;
}

export interface ScienceFactor {
  element: string;
  reason: string;
}

export type CompletedMap = Record<string, Record<string, boolean>>;
export type SetsMap = Record<string, Record<string, number[]>>;
export type ConfettiMap = Record<string, boolean>;
