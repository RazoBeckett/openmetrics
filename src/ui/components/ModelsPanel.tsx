import React from "react";
import { Box, Text } from "ink";
import type { ModelMetrics } from "../../types/index.ts";

interface ModelsPanelProps {
  models: ModelMetrics[];
  selectedIndex: number;
  isActive: boolean;
}

const VISIBLE_COUNT = 15;

export function ModelsPanel({ models, selectedIndex, isActive }: ModelsPanelProps) {
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const formatCost = (c: number | null): string => {
    if (c === null) return "?";
    return `$${c.toFixed(2)}`;
  };

  let scrollOffset = 0;
  if (selectedIndex >= VISIBLE_COUNT) {
    scrollOffset = selectedIndex - VISIBLE_COUNT + 1;
  }

  const visibleModels = models.slice(scrollOffset, scrollOffset + VISIBLE_COUNT);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + VISIBLE_COUNT < models.length;

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
          Models ({models.length})
        </Text>
      </Box>

      <Text dimColor>
        {hasMoreAbove ? `↑ ${scrollOffset} more above` : " "}
      </Text>

      {visibleModels.map((model, idx) => {
        const actualIndex = scrollOffset + idx;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={`${model.providerId}-${model.modelId}`} gap={1}>
            <Text color={isSelected ? "cyan" : undefined} inverse={isSelected}>
              {isSelected ? ">" : " "}
            </Text>
            <Box width={24}>
              <Text color={isSelected ? "cyan" : undefined} wrap="truncate">
                {model.modelId.slice(0, 22)}
              </Text>
            </Box>
            <Box width={8}>
              <Text color="yellow">{formatTokens(model.inputTokens)}</Text>
            </Box>
            <Box width={8}>
              <Text color="magenta">{formatTokens(model.outputTokens)}</Text>
            </Box>
            <Box width={8}>
              <Text color="green">{formatCost(model.estimatedCost)}</Text>
            </Box>
          </Box>
        );
      })}

      <Text dimColor>
        {hasMoreBelow ? `↓ ${models.length - scrollOffset - VISIBLE_COUNT} more below` : " "}
      </Text>

      <Box marginTop={1}>
        <Text dimColor>
          <Text color="yellow">In</Text> / <Text color="magenta">Out</Text> / <Text color="green">Cost</Text>
        </Text>
      </Box>
    </Box>
  );
}
