import React from "react"
import { Box, Text } from "ink"
import { describeFlags } from "../../utils/flags.ts"
import { sessionClock } from "../clock.ts"
import type { Observed } from "../sessionStore.ts"

interface Props {
  session: Observed | null
}

export const StatusDisplay: React.FC<Props> = ({ session }) => {
  if (!session) {
    return (
      <Box flexDirection="column">
        <Text dimColor>○ Inactive — no caffeinate running</Text>
      </Box>
    )
  }

  const { info, at } = session
  const { elapsed, remaining, remainingColor } = sessionClock(info, at)

  return (
    <Box flexDirection="column">
      <Text color="green">● Active — preventing sleep</Text>
      <Text>  {describeFlags(info.flags)}</Text>
      <Text>  Running for {elapsed}</Text>
      {info.watching && (
        <Text>  Until {info.watching.name} exits <Text dimColor>(PID {info.watching.pid})</Text></Text>
      )}
      {remaining !== null ? (
        <Text>  Remaining: <Text color={remainingColor}>{remaining}</Text></Text>
      ) : (
        !info.watching && <Text dimColor>  Duration: indefinite</Text>
      )}
    </Box>
  )
}
