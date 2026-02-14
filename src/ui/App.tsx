import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "@inkjs/ui";

import { TopBar } from "./components/TopBar.tsx";
import { ModelsPanel } from "./components/ModelsPanel.tsx";
import { ChartsPanel } from "./components/ChartsPanel.tsx";
import { SessionsPanel } from "./components/SessionsPanel.tsx";
import { HelpBar } from "./components/HelpBar.tsx";
import { ModelDetailView } from "./components/ModelDetailView.tsx";

import { createDatabase } from "../db/database.ts";
import { MetricsAggregator } from "../metrics/aggregator.ts";
import { createPricingService } from "../pricing/models-dev.ts";

import type {
  ModelMetrics,
  SessionMetrics,
  DailyMetrics,
  DashboardSummary,
  ActivePanel,
  ViewMode,
} from "../types/index.ts";

interface AppProps {
  dbPath: string;
}

export function App({ dbPath }: AppProps) {
  const { exit } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [models, setModels] = useState<ModelMetrics[]>([]);
  const [sessions, setSessions] = useState<SessionMetrics[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);

  const [activePanel, setActivePanel] = useState<ActivePanel>("models");
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);

  const [modelDetailMetrics, setModelDetailMetrics] = useState<DailyMetrics[]>([]);
  const [modelDetailSessions, setModelDetailSessions] = useState<SessionMetrics[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const db = createDatabase(dbPath);
      const validation = db.validate();

      if (!validation.valid) {
        setError(validation.error || "Invalid database");
        setIsLoading(false);
        return;
      }

      const pricingService = createPricingService();
      await pricingService.load();

      const aggregator = new MetricsAggregator(db);
      aggregator.setPricingBulk(pricingService.getPricingMap());

      const modelData = aggregator.getModelMetrics();
      const sessionData = aggregator.getSessionMetrics();
      const dailyData = aggregator.getDailyMetrics();
      const summaryData = aggregator.getDashboardSummary();

      setModels(modelData);
      setSessions(sessionData);
      setDailyMetrics(dailyData);
      setSummary(summaryData);

      db.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }

    setIsLoading(false);
  }, [dbPath]);

  const loadModelDetail = useCallback(async (modelId: string) => {
    try {
      const db = createDatabase(dbPath);
      const aggregator = new MetricsAggregator(db);

      const daily = aggregator.getModelDailyMetrics(modelId);
      const topSessions = aggregator.getTopSessionsForModel(modelId, 10);

      setModelDetailMetrics(daily);
      setModelDetailSessions(topSessions);

      db.close();
    } catch {
      setModelDetailMetrics([]);
      setModelDetailSessions([]);
    }
  }, [dbPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    if (input === "r") {
      if (viewMode === "model-detail" && models[selectedModelIndex]) {
        loadModelDetail(models[selectedModelIndex].modelId);
      } else {
        loadData();
      }
      return;
    }

    if (viewMode === "model-detail") {
      if (key.escape || input === "b") {
        setViewMode("dashboard");
      }
      return;
    }

    if (key.tab) {
      const panels: ActivePanel[] = ["models", "sessions", "charts"];
      const currentIdx = panels.indexOf(activePanel);
      setActivePanel(panels[(currentIdx + 1) % panels.length]);
      return;
    }

    const moveSelection = (delta: number) => {
      if (activePanel === "models") {
        setSelectedModelIndex((prev) =>
          Math.max(0, Math.min(models.length - 1, prev + delta))
        );
      } else if (activePanel === "sessions") {
        setSelectedSessionIndex((prev) =>
          Math.max(0, Math.min(sessions.length - 1, prev + delta))
        );
      }
    };

    if (input === "j" || key.downArrow) {
      moveSelection(1);
      return;
    }

    if (input === "k" || key.upArrow) {
      moveSelection(-1);
      return;
    }

    if (key.return && activePanel === "models" && models[selectedModelIndex]) {
      const model = models[selectedModelIndex];
      loadModelDetail(model.modelId);
      setViewMode("model-detail");
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box gap={1}>
          <Spinner label="Loading metrics..." />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>Error</Text>
        <Text color="red">{error}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }

  if (viewMode === "model-detail" && models[selectedModelIndex]) {
    return (
      <Box flexDirection="column">
        <TopBar
          dbPath={dbPath}
          totalTokens={summary?.totalTokens || 0}
          totalCost={summary?.totalEstimatedCost || null}
        />
        <ModelDetailView
          model={models[selectedModelIndex]}
          dailyMetrics={modelDetailMetrics}
          topSessions={modelDetailSessions}
        />
        <HelpBar viewMode="model-detail" />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <TopBar
        dbPath={dbPath}
        totalTokens={summary?.totalTokens || 0}
        totalCost={summary?.totalEstimatedCost || null}
      />

      <Box>
        <ModelsPanel
          models={models}
          selectedIndex={selectedModelIndex}
          isActive={activePanel === "models"}
        />
        <ChartsPanel
          dailyMetrics={dailyMetrics}
          isActive={activePanel === "charts"}
        />
      </Box>

      <SessionsPanel
        sessions={sessions}
        selectedIndex={selectedSessionIndex}
        isActive={activePanel === "sessions"}
      />

      <HelpBar viewMode="dashboard" />
    </Box>
  );
}
