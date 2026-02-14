import React from "react";
import { Box, Text } from "ink";
import type { DailyMetrics } from "../../types/index.ts";

interface ChartsPanelProps {
  dailyMetrics: DailyMetrics[];
  isActive: boolean;
}

export function ChartsPanel({ dailyMetrics, isActive }: ChartsPanelProps) {
  const recentDays = dailyMetrics.slice(-14);
  
  if (recentDays.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={isActive ? "green" : "gray"}
        width="50%"
        paddingX={1}
      >
        <Text bold color={isActive ? "green" : "white"}>Activity</Text>
        <Text dimColor>No data available</Text>
      </Box>
    );
  }

  const maxTokens = Math.max(...recentDays.map((d) => d.totalTokens), 1);
  const maxMessages = Math.max(...recentDays.map((d) => d.messageCount), 1);
  const barChars = "▁▂▃▄▅▆▇█";

  const getBar = (value: number, max: number): string => {
    const normalized = Math.floor((value / max) * (barChars.length - 1));
    return barChars[Math.min(normalized, barChars.length - 1)];
  };

  const tokenBars = recentDays.map((d) => getBar(d.totalTokens, maxTokens)).join("");
  const messageBars = recentDays.map((d) => getBar(d.messageCount, maxMessages)).join("");

  const formatNum = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const totalTokensInPeriod = recentDays.reduce((sum, d) => sum + d.totalTokens, 0);
  const totalMessagesInPeriod = recentDays.reduce((sum, d) => sum + d.messageCount, 0);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isActive ? "green" : "gray"}
      width="50%"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color={isActive ? "green" : "white"}>
          Activity (Last {recentDays.length} days)
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>Tokens/day</Text>
        <Text color="cyan">{tokenBars}</Text>
        <Text dimColor>
          Total: {formatNum(totalTokensInPeriod)} | Peak: {formatNum(maxTokens)}
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text>Messages/day</Text>
        <Text color="magenta">{messageBars}</Text>
        <Text dimColor>
          Total: {totalMessagesInPeriod} | Peak: {maxMessages}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          {recentDays[0]?.date} → {recentDays[recentDays.length - 1]?.date}
        </Text>
      </Box>
    </Box>
  );
}
