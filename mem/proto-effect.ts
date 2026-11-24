// Prototype: same as proto.ts, but each tick runs through the Effect runtime.
import { Effect, Option } from "effect"
// Prototype: latte's TUI loop with no Ink/React/Effect. Same per-second work:
// pgrep + ps, then redraw the screen only when the text changes.
const run = async (args: string[]) => {
  const p = Bun.spawn(args, { stdout: "pipe", stderr: "ignore" })
  const out = await new Response(p.stdout).text()
  await p.exited
  return out
}

let session: { pid: number; start: Date } | null = null
let last = ""

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h && `${h}h`, m && `${m}m`, sec && `${sec}s`].filter(Boolean).join(" ") || "0s"
}

const draw = () => {
  const lines = [" ☕ latte", ""]
  if (session) {
    lines.push(" \x1b[32m● Active — preventing sleep\x1b[0m", "   Prevents idle sleep", `   Running for ${fmt(Math.floor((Date.now() - session.start.getTime()) / 1000))}`, "\x1b[2m   Duration: indefinite\x1b[0m")
  } else lines.push("\x1b[2m ○ Inactive — no caffeinate running\x1b[0m")
  lines.push("", " \x1b[1;36m[o]\x1b[0m on  \x1b[1;36m[x]\x1b[0m off  \x1b[1;36m[q]\x1b[0m quit")
  const frame = lines.join("\n")
  if (frame === last) return
  process.stderr.write("\x1b[H\x1b[J" + frame)
  last = frame
}

const detect = async () => {
  const pids = (await run(["pgrep", "-x", "caffeinate"])).trim().split("\n").filter(Boolean)
  if (!pids.length) { session = null; return }
  const line = (await run(["ps", "-o", "pid=,lstart=,args=", "-p", pids[0]!])).trim()
  const m = line.match(/^(\d+)\s+(\S+\s+\S+\s+\d+\s+[\d:]+\s+\d{4})/)
  session = m ? { pid: Number(m[1]), start: new Date(m[2]!) } : null
}

process.stdin.setRawMode(true)
process.stdin.on("data", async (b) => {
  const k = b.toString()
  if (k === "q" || k === "\x03") process.exit(0)
  if (k === "o") { Bun.spawn(["caffeinate", "-i"], { stdio: ["ignore", "ignore", "ignore"] }).unref(); await Bun.sleep(100); await detect(); draw() }
  if (k === "x") { await run(["pkill", "-x", "caffeinate"]); await detect(); draw() }
})
await detect(); draw()
setInterval(() => { if (session) void Effect.runPromise(Effect.gen(function* () { yield* Effect.promise(detect); return Option.some(1) })).then(draw) }, 1000)
