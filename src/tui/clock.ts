import type { CaffeinateInfo } from "../types/index.ts"
import { formatDuration } from "../utils/duration.ts"
import { elapsedSeconds, remainingSeconds } from "./changes.ts"

/** The time-dependent part of the status screen, shown to the minute. */
export interface Clock {
  elapsed: string
  remaining: string | null
  remainingColor: "red" | "yellow" | undefined
}

export const sessionClock = (info: CaffeinateInfo, at: Date): Clock => {
  const elapsed = elapsedSeconds(info, at)
  const remaining = remainingSeconds(info, at)
  return {
    elapsed: elapsed < 60 ? "<1m" : formatDuration(elapsed - (elapsed % 60)),
    remaining: remaining === null ? null : formatDuration(Math.ceil(remaining / 60) * 60),
    remainingColor: remaining === null
      ? undefined
      : remaining < 60
        ? "red"
        : info.duration !== null && remaining < info.duration * 0.1
          ? "yellow"
          : undefined,
  }
}

export const sameClock = (a: Clock, b: Clock): boolean =>
  a.elapsed === b.elapsed && a.remaining === b.remaining && a.remainingColor === b.remainingColor
