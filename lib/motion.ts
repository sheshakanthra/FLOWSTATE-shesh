export interface MotionToken {
  duration: number;
  ease: [number, number, number, number];
}

export const instant: MotionToken = { duration: 0.09, ease: [0.2, 0, 0, 1] };
export const fast: MotionToken = { duration: 0.16, ease: [0.2, 0, 0, 1] };
export const base: MotionToken = { duration: 0.24, ease: [0.32, 0.72, 0, 1] };
export const slow: MotionToken = { duration: 0.38, ease: [0.32, 0.72, 0, 1] };

export interface SpringToken {
  type: "spring";
  stiffness: number;
  damping: number;
}

export const spring: SpringToken = { type: "spring", stiffness: 380, damping: 32 };

export const motion = { instant, fast, base, slow, spring } as const;
