export type FiringStatus = "running" | "success" | "error" | "cancelled";

export interface FiringOperation {
  id: string;
  label: string;
  initiator: string;
  startedAt: number;
  /** 0-1, or null while indeterminate. */
  progress: number | null;
  status: FiringStatus;
}

export interface StartOptions {
  label: string;
  initiator: string;
}
