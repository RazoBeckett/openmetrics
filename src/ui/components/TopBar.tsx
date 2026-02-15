import React from "react";
import { Box, Text } from "ink";

interface TopBarProps {
  dbPath: string;
  totalTokens: number;
  totalCost: number;
}

export function TopBar({ dbPath, totalTokens, totalCost }: TopBarProps) {
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const formatCost = (c: number): string => {
    return `$${c.toFixed(2)}`;
  };

  const shortPath = dbPath.length > 40 ? `...${dbPath.slice(-37)}` : dbPath;

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        openmetrics
      </Text>
      <Text dimColor>{shortPath}</Text>
      <Text>
        Tokens: <Text color="yellow">{formatTokens(totalTokens)}</Text>
      </Text>
      <Text>
        Cost: <Text color="green">{formatCost(totalCost)}</Text>
      </Text>
    </Box>
  );
}
