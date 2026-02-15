import { useState, useEffect, useCallback, useRef } from "react";
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
import { createPricingService, calculateTokenCost } from "../pricing/models-dev.ts";
import type { PricingLookupTarget } from "../pricing/models-dev.ts";

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
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingSkeletonFrame, setPricingSkeletonFrame] = useState(0);

  const loadVersionRef = useRef(0);

  const loadData = useCallback(async () => {
    const loadVersion = ++loadVersionRef.current;

    setIsLoading(true);
    setIsPricingLoading(false);
    setPricingSkeletonFrame(0);
    setError(null);

    let db: ReturnType<typeof createDatabase> | null = null;

    try {
      db = createDatabase(dbPath);
      const validation = db.validate();

      if (!validation.valid) {
        if (loadVersionRef.current !== loadVersion) return;
        setError(validation.error || "Invalid database");
        setIsLoading(false);
        return;
      }

      const aggregator = new MetricsAggregator(db);
      const baseModelData = aggregator.getModelMetrics();
      const sessionData = aggregator.getSessionMetrics();
      const dailyData = aggregator.getDailyMetrics();
      const summaryData = aggregator.getDashboardSummary();

      if (loadVersionRef.current !== loadVersion) return;

      setModels(baseModelData);
      setSessions(sessionData);
      setDailyMetrics(dailyData);
      setSummary(summaryData);

      setIsLoading(false);

      const pricingTargets: PricingLookupTarget[] = baseModelData.map((model) => ({
        modelId: model.modelId,
        providerId: model.providerId,
      }));

      if (pricingTargets.length === 0) {
        return;
      }

      setIsPricingLoading(true);

      void (async () => {
        try {
          const pricingService = createPricingService();
          await pricingService.load(pricingTargets);

          if (loadVersionRef.current !== loadVersion) return;

          const pricedModels = baseModelData.map((model) => {
            const pricing = pricingService.getPricing(model.modelId, model.providerId);

            if (!pricing) {
              return {
                ...model,
                inputCost: null,
                outputCost: null,
                estimatedCost: null,
              };
            }

            const inputCost = (model.inputTokens / 1_000_000) * pricing.input;
            const outputCost = (model.outputTokens / 1_000_000) * pricing.output;
            const estimatedCost = calculateTokenCost(
              pricing,
              model.inputTokens,
              model.outputTokens,
              model.cacheReadTokens,
              model.cacheWriteTokens
            );

            return {
              ...model,
              inputCost,
              outputCost,
              estimatedCost,
            };
          });

          let totalEstimatedCost = 0;
          for (const model of pricedModels) {
            if (model.estimatedCost !== null) {
              totalEstimatedCost += model.estimatedCost;
            }
          }

          setModels(pricedModels);
          setSummary((prev) => {
            if (!prev) return prev;

            return {
              ...prev,
              totalEstimatedCost,
            };
          });
        } catch (pricingErr) {
          if (loadVersionRef.current !== loadVersion) return;
          console.error("Failed to load pricing data in background:", pricingErr);
        } finally {
          if (loadVersionRef.current === loadVersion) {
            setIsPricingLoading(false);
            setPricingSkeletonFrame(0);
          }
        }
      })();
    } catch (err) {
      if (loadVersionRef.current !== loadVersion) return;
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsLoading(false);
    } finally {
      db?.close();
    }
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

  useEffect(() => {
    if (!isPricingLoading) return;

    const interval = setInterval(() => {
      setPricingSkeletonFrame((frame) => (frame + 1) % 4);
    }, 160);

    return () => {
      clearInterval(interval);
    };
  }, [isPricingLoading]);

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
          totalCost={summary?.totalEstimatedCost || 0}
        />
        <ModelDetailView
          model={models[selectedModelIndex]}
          dailyMetrics={modelDetailMetrics}
          topSessions={modelDetailSessions}
          isPricingLoading={isPricingLoading}
          pricingSkeletonFrame={pricingSkeletonFrame}
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
        totalCost={summary?.totalEstimatedCost || 0}
      />

      <Box>
        <ModelsPanel
          models={models}
          selectedIndex={selectedModelIndex}
          isActive={activePanel === "models"}
          isPricingLoading={isPricingLoading}
          pricingSkeletonFrame={pricingSkeletonFrame}
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
