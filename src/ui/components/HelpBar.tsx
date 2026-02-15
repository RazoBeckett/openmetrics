import React from "react";
import { Box, Text } from "ink";

interface HelpBarProps {
  viewMode: "dashboard" | "model-detail";
}

export function HelpBar({ viewMode }: HelpBarProps) {
  if (viewMode === "model-detail") {
    return (
      <Box paddingX={1} gap={2}>
        <Text dimColor>
          <Text color="yellow">ESC</Text> back
        </Text>
        <Text dimColor>
          <Text color="yellow">r</Text> refresh
        </Text>
        <Text dimColor>
          <Text color="yellow">q</Text> quit
        </Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} gap={2}>
      <Text dimColor>
        <Text color="yellow">click</Text> switch
      </Text>
      <Text dimColor>
        <Text color="yellow">scroll</Text> navigate
      </Text>
      <Text dimColor>
        <Text color="yellow">TAB</Text> switch panel
      </Text>
      <Text dimColor>
        <Text color="yellow">j/k</Text> navigate
      </Text>
      <Text dimColor>
        <Text color="yellow">ENTER</Text> details
      </Text>
      <Text dimColor>
        <Text color="yellow">s</Text> toggle pricing
      </Text>
      <Text dimColor>
        <Text color="yellow">r</Text> refresh
      </Text>
      <Text dimColor>
        <Text color="yellow">q</Text> quit
      </Text>
    </Box>
  );
}
