// Prototype: the same screen and per-second work as proto.ts, drawn with Ink/React. No Effect.
import React, { useEffect, useState } from "react"
import { render, Box, Text, useInput, useApp } from "ink"

const run = async (args: string[]) => {
  const p = Bun.spawn(args, { stdout: "pipe", stderr: "ignore" })
  const o = await new Response(p.stdout).text()
  await p.exited
  return o
}
const detect = async () => {
  const pids = (await run(["pgrep", "-x", "caffeinate"])).trim().split("\n").filter(Boolean)
  if (!pids.length) return null
  const line = (await run(["ps", "-o", "pid=,lstart=,args=", "-p", pids[0]!])).trim()
  const m = line.match(/^(\d+)\s+(\S+\s+\S+\s+\d+\s+[\d:]+\s+\d{4})/)
  return m ? { pid: Number(m[1]), start: new Date(m[2]!) } : null
}

const App = () => {
  const { exit } = useApp()
  const [s, setS] = useState<{ pid: number; start: Date } | null>(null)
  useEffect(() => {
    const i = setInterval(async () => setS(await detect()), 1000)
    return () => clearInterval(i)
  }, [])
  useInput((i) => {
    if (i === "q") exit()
    if (i === "o") Bun.spawn(["caffeinate", "-i"], { stdio: ["ignore", "ignore", "ignore"] }).unref()
  })
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}><Text bold>☕ latte</Text></Box>
      {s ? (
        <Box flexDirection="column">
          <Text color="green">● Active — preventing sleep</Text>
          <Text>  Running for {Math.floor((Date.now() - s.start.getTime()) / 1000)}s</Text>
        </Box>
      ) : <Text dimColor>○ Inactive</Text>}
      <Box marginTop={1} gap={2}>{["o on", "x off", "q quit"].map((k) => <Text key={k} color="cyan">[{k}]</Text>)}</Box>
    </Box>
  )
}
render(<App />, { stdout: process.stderr })
