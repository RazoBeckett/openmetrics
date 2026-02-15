import { useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "@inkjs/ui";

import { TopBar } from "./components/TopBar.tsx";
import { ModelsPanel } from "./components/ModelsPanel.tsx";
import { ChartsPanel } from "./components/ChartsPanel.tsx";
import { SessionsPanel } from "./components/SessionsPanel.tsx";
import { HelpBar } from "./components/HelpBar.tsx";
import { ModelDetailView } from "./components/ModelDetailView.tsx";

import { useAppStore } from "../store/appStore.ts";

interface AppProps {
  dbPath: string;
}

export function App({ dbPath }: AppProps) {
  const { exit } = useApp();

  const {
    isLoading,
    error,
    summary,
    models,
    sessions,
    dailyMetrics,
    activePanel,
    viewMode,
    selectedModelIndex,
    selectedSessionIndex,
    modelDetailMetrics,
    modelDetailSessions,
    isPricingLoading,
    pricingSkeletonFrame,
    showParentProviderPricing,
    setViewMode,
    setActivePanel,
    setSelectedModelIndex,
    setSelectedSessionIndex,
    toggleShowParentProviderPricing,
    recalculatePricing,
    loadData,
    loadModelDetail,
    setPricingSkeletonFrame,
  } = useAppStore();

  useEffect(() => {
    useAppStore.getState().setDbPath(dbPath);
    loadData();
  }, [dbPath, loadData]);

  useEffect(() => {
    if (!isPricingLoading) return;

    const interval = setInterval(() => {
      setPricingSkeletonFrame((pricingSkeletonFrame + 1) % 4);
    }, 160);

    return () => clearInterval(interval);
  }, [isPricingLoading, pricingSkeletonFrame, setPricingSkeletonFrame]);

  useEffect(() => {
    recalculatePricing();
  }, [showParentProviderPricing, recalculatePricing]);

  const handleMoveSelection = useCallback((delta: number) => {
    if (activePanel === "models") {
      setSelectedModelIndex(Math.max(0, Math.min(models.length - 1, selectedModelIndex + delta)));
    } else if (activePanel === "sessions") {
      setSelectedSessionIndex(Math.max(0, Math.min(sessions.length - 1, selectedSessionIndex + delta)));
    }
  }, [activePanel, models.length, sessions.length, selectedModelIndex, selectedSessionIndex, setSelectedModelIndex, setSelectedSessionIndex]);

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

    if (input === "s" && viewMode === "dashboard") {
      toggleShowParentProviderPricing();
      return;
    }

    if (viewMode === "model-detail") {
      if (key.escape || input === "b") {
        setViewMode("dashboard");
      }
      return;
    }

    if (key.tab) {
      const panels: ["models", "sessions", "charts"] = ["models", "sessions", "charts"];
      const currentIdx = panels.indexOf(activePanel);
      setActivePanel(panels[(currentIdx + 1) % panels.length]);
      return;
    }

    if (input === "j" || key.downArrow) {
      handleMoveSelection(1);
      return;
    }

    if (input === "k" || key.upArrow) {
      handleMoveSelection(-1);
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
          showParentPricing={showParentProviderPricing}
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
