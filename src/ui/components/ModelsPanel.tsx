import React from "react";
import { Box, Text } from "ink";
import type { ModelMetrics } from "../../types/index.ts";

interface ModelsPanelProps {
  models: ModelMetrics[];
  selectedIndex: number;
  isActive: boolean;
}

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

  const visibleModels = models.slice(0, 15);

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

      {visibleModels.map((model, idx) => {
        const isSelected = idx === selectedIndex;
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

      {models.length > 15 && (
        <Text dimColor>... and {models.length - 15} more</Text>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          <Text color="yellow">In</Text> / <Text color="magenta">Out</Text> / <Text color="green">Cost</Text>
        </Text>
      </Box>
    </Box>
  );
}
