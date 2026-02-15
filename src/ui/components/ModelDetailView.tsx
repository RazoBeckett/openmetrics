import { Box, Text } from "ink";
import type { ModelMetrics, DailyMetrics, SessionMetrics } from "../../types/index.ts";

interface ModelDetailViewProps {
  model: ModelMetrics;
  dailyMetrics: DailyMetrics[];
  topSessions: SessionMetrics[];
  isPricingLoading: boolean;
  pricingSkeletonFrame: number;
}

const PRICE_SKELETON_FRAMES = ["[.....]", "[=....]", "[==...]", "[===..]"];

export function ModelDetailView({
  model,
  dailyMetrics,
  topSessions,
  isPricingLoading,
  pricingSkeletonFrame,
}: ModelDetailViewProps) {
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const formatCost = (c: number | null): string => {
    if (c === null) {
      if (isPricingLoading) {
        return PRICE_SKELETON_FRAMES[pricingSkeletonFrame % PRICE_SKELETON_FRAMES.length];
      }

      return "Unknown";
    }

    return `$${c.toFixed(4)}`;
  };

  const barChars = "▁▂▃▄▅▆▇█";
  const recentDays = dailyMetrics.slice(-21);
  const maxTokens = Math.max(...recentDays.map((d) => d.totalTokens), 1);

  const getBar = (value: number, max: number): string => {
    const normalized = Math.floor((value / max) * (barChars.length - 1));
    return barChars[Math.min(normalized, barChars.length - 1)];
  };

  const tokenBars = recentDays.map((d) => getBar(d.totalTokens, maxTokens)).join("");

  const inputRatio = model.totalTokens > 0 
    ? ((model.inputTokens / model.totalTokens) * 100).toFixed(1) 
    : "0";
  const outputRatio = model.totalTokens > 0 
    ? ((model.outputTokens / model.totalTokens) * 100).toFixed(1) 
    : "0";

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">
          {model.modelId}
        </Text>
        <Text dimColor> ({model.providerId})</Text>
      </Box>

      <Box gap={4} marginBottom={1}>
        <Box flexDirection="column">
          <Text>Total Tokens</Text>
          <Text bold color="yellow">{formatTokens(model.totalTokens)}</Text>
        </Box>
        <Box flexDirection="column">
          <Text>Messages</Text>
          <Text bold>{model.messageCount}</Text>
        </Box>
        <Box flexDirection="column">
          <Text>Est. Cost</Text>
          <Text bold color="green">{formatCost(model.estimatedCost)}</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>Input/Output Ratio</Text>
        <Box gap={2}>
          <Text color="cyan">Input: {inputRatio}%</Text>
          <Text color="magenta">Output: {outputRatio}%</Text>
        </Box>
        <Box>
          <Text color="cyan">{"█".repeat(Math.round(Number(inputRatio) / 5))}</Text>
          <Text color="magenta">{"█".repeat(Math.round(Number(outputRatio) / 5))}</Text>
        </Box>
      </Box>

      {recentDays.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text>Daily Usage (Last {recentDays.length} days)</Text>
          <Text color="cyan">{tokenBars}</Text>
          <Text dimColor>
            {recentDays[0]?.date} → {recentDays[recentDays.length - 1]?.date}
          </Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text bold>Top Sessions</Text>
        {topSessions.slice(0, 5).map((session) => (
          <Box key={session.sessionId} gap={2}>
            <Box width={30}>
              <Text wrap="truncate">{session.title.slice(0, 28)}</Text>
            </Box>
            <Text color="yellow">{formatTokens(session.totalTokens)}</Text>
            <Text dimColor>{session.messageCount} msgs</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
