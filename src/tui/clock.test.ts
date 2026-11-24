import { test, expect } from "bun:test"
import type { CaffeinateInfo } from "../types/index.ts"
import { sessionClock } from "./clock.ts"

const now = new Date("2026-11-05T12:00:00Z")
const startedAgo = (seconds: number, duration: number | null = null): CaffeinateInfo => ({
  pid: 42,
  flags: "-is",
  startTime: new Date(now.getTime() - seconds * 1000),
  duration,
  remaining: null,
  watching: null,
})

test("shows time running to the minute, rounded down", () => {
  expect(sessionClock(startedAgo(0), now).elapsed).toBe("<1m")
  expect(sessionClock(startedAgo(59), now).elapsed).toBe("<1m")
  expect(sessionClock(startedAgo(125), now).elapsed).toBe("2m")
  expect(sessionClock(startedAgo(3723), now).elapsed).toBe("1h 2m")
})

test("shows time left to the minute, rounded up, so it never reads 0 while running", () => {
  expect(sessionClock(startedAgo(0, 90), now).remaining).toBe("2m")
  expect(sessionClock(startedAgo(60, 90), now).remaining).toBe("1m")
  expect(sessionClock(startedAgo(89, 90), now).remaining).toBe("1m")
  expect(sessionClock(startedAgo(0, 7200), now).remaining).toBe("2h")
  expect(sessionClock(startedAgo(0), now).remaining).toBeNull()
})

test("colors time left red in the last minute and yellow in the last tenth", () => {
  expect(sessionClock(startedAgo(0, 1000), now).remainingColor).toBeUndefined()
  expect(sessionClock(startedAgo(901, 1000), now).remainingColor).toBe("yellow")
  expect(sessionClock(startedAgo(941, 1000), now).remainingColor).toBe("red")
})
