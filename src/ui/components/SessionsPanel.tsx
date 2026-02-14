import React from "react";
import { Box, Text } from "ink";
import type { SessionMetrics } from "../../types/index.ts";

interface SessionsPanelProps {
  sessions: SessionMetrics[];
  selectedIndex: number;
  isActive: boolean;
}

const VISIBLE_COUNT = 10;

export function SessionsPanel({ sessions, selectedIndex, isActive }: SessionsPanelProps) {
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const formatDate = (d: Date): string => {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "today";
    if (days === 1) return "1d ago";
    if (days < 7) return `${days}d ago`;
    return d.toISOString().split("T")[0];
  };

  let scrollOffset = 0;
  if (selectedIndex >= VISIBLE_COUNT) {
    scrollOffset = selectedIndex - VISIBLE_COUNT + 1;
  }

  const visibleSessions = sessions.slice(scrollOffset, scrollOffset + VISIBLE_COUNT);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + VISIBLE_COUNT < sessions.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isActive ? "green" : "gray"}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color={isActive ? "green" : "white"}>
          Top Sessions ({sessions.length} total)
        </Text>
      </Box>

      <Box gap={2} marginBottom={1}>
        <Box width={30}><Text dimColor>Title</Text></Box>
        <Box width={6}><Text dimColor>Msgs</Text></Box>
        <Box width={8}><Text dimColor>Tokens</Text></Box>
        <Box width={10}><Text dimColor>Updated</Text></Box>
      </Box>

      <Text dimColor>
        {hasMoreAbove ? `↑ ${scrollOffset} more above` : " "}
      </Text>

      {visibleSessions.map((session, idx) => {
        const actualIndex = scrollOffset + idx;
        const isSelected = actualIndex === selectedIndex && isActive;
        return (
          <Box key={session.sessionId} gap={2}>
            <Text color={isSelected ? "cyan" : undefined} inverse={isSelected}>
              {isSelected ? ">" : " "}
            </Text>
            <Box width={28}>
              <Text color={isSelected ? "cyan" : undefined} wrap="truncate">
                {session.title.slice(0, 26)}
              </Text>
            </Box>
            <Box width={6}>
              <Text>{session.messageCount}</Text>
            </Box>
            <Box width={8}>
              <Text color="yellow">{formatTokens(session.totalTokens)}</Text>
            </Box>
            <Box width={10}>
              <Text dimColor>{formatDate(session.lastUpdated)}</Text>
            </Box>
          </Box>
        );
      })}

      <Text dimColor>
        {hasMoreBelow ? `↓ ${sessions.length - scrollOffset - VISIBLE_COUNT} more below` : " "}
      </Text>
    </Box>
  );
}
