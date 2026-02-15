import { Box, Text } from "ink";
import type { ModelMetrics } from "../../types/index.ts";
import { getParentProvider } from "../../pricing/models-dev.ts";

interface ModelsPanelProps {
  models: ModelMetrics[];
  selectedIndex: number;
  isActive: boolean;
  isPricingLoading: boolean;
  pricingSkeletonFrame: number;
  showParentPricing: boolean;
}

const VISIBLE_COUNT = 15;
const PRICE_SKELETON_FRAMES = ["[.....]", "[=....]", "[==...]", "[===..]"];

export function ModelsPanel({
  models,
  selectedIndex,
  isActive,
  isPricingLoading,
  pricingSkeletonFrame,
  showParentPricing,
}: ModelsPanelProps) {
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const formatCost = (c: number | null): string => {
    if (c === null) {
      if (isPricingLoading) {
        return PRICE_SKELETON_FRAMES[pricingSkeletonFrame % PRICE_SKELETON_FRAMES.length];
      }

      return "?";
    }

    return `$${c.toFixed(2)}`;
  };

  const formatProvider = (providerId: string): string => {
    if (providerId.length > 16) {
      return providerId.slice(0, 16) + "…";
    }
    return providerId;
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
      width="55%"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color={isActive ? "green" : "white"}>
          Models ({models.length})
        </Text>
        <Text dimColor> [{showParentPricing ? "Source" : "Current"}]</Text>
      </Box>

      <Box marginBottom={1}>
        <Box width={2}>
          <Text> </Text>
        </Box>
        <Box width={22}>
          <Text dimColor>Model</Text>
        </Box>
        <Box width={7}>
          <Text color="yellow" bold>In</Text>
        </Box>
        <Box width={7}>
          <Text color="magenta" bold>Out</Text>
        </Box>
        <Box width={10}>
          <Text color="yellow" bold>In ($)</Text>
        </Box>
        <Box width={10}>
          <Text color="magenta" bold>Out ($)</Text>
        </Box>
        <Box width={9}>
          <Text color="green" bold>Cost</Text>
        </Box>
        <Box width={17}>
          <Text color="cyanBright" bold>Provider</Text>
        </Box>
      </Box>

      {visibleModels.map((model, idx) => {
        const actualIndex = scrollOffset + idx;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={`${model.providerId}-${model.modelId}`}>
            <Box width={2}>
              <Text color={isSelected ? "cyan" : undefined} inverse={isSelected}>
                {isSelected ? ">" : " "}
              </Text>
            </Box>
            <Box width={22}>
              <Text color={isSelected ? "cyan" : undefined} wrap="truncate">
                {model.modelId.slice(0, 20)}
              </Text>
            </Box>
            <Box width={7}>
              <Text color="yellow">{formatTokens(model.inputTokens)}</Text>
            </Box>
            <Box width={7}>
              <Text color="magenta">{formatTokens(model.outputTokens)}</Text>
            </Box>
            <Box width={10}>
              <Text color="yellow">{formatCost(model.inputCost)}</Text>
            </Box>
            <Box width={10}>
              <Text color="magenta">{formatCost(model.outputCost)}</Text>
            </Box>
            <Box width={9}>
              <Text color="green">{formatCost(model.estimatedCost)}</Text>
            </Box>
            <Box width={17}>
              <Text color="cyanBright">
                {showParentPricing
                  ? formatProvider(getParentProvider(model.modelId) || model.providerId)
                  : formatProvider(model.providerId)}
              </Text>
            </Box>
          </Box>
        );
      })}

      <Box>
        {hasMoreBelow && (
          <Text dimColor>
            ↓ {models.length - scrollOffset - VISIBLE_COUNT} more below
          </Text>
        )}
        {hasMoreBelow && hasMoreAbove && (
          <Text dimColor> │ </Text>
        )}
        {hasMoreAbove && (
          <Text dimColor>
            ↑ {scrollOffset} more above
          </Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          <Text color="yellow"> Input Tokens</Text> / <Text color="magenta">Output Tokens</Text> / <Text color="green">Cost </Text>
        </Text>
      </Box>
    </Box>
  );
}
