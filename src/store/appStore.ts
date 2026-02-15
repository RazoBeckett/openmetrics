import { create } from "zustand";
import type { ModelMetrics, SessionMetrics, DailyMetrics, DashboardSummary, ActivePanel, ViewMode } from "../types/index.ts";
import type { PricingLookupTarget } from "../pricing/models-dev.ts";
import { createPricingService, calculateTokenCost } from "../pricing/models-dev.ts";
import { createDatabase } from "../db/database.ts";
import { MetricsAggregator } from "../metrics/aggregator.ts";

interface AppState {
  isLoading: boolean;
  error: string | null;
  summary: DashboardSummary | null;
  models: ModelMetrics[];
  sessions: SessionMetrics[];
  dailyMetrics: DailyMetrics[];
  activePanel: ActivePanel;
  viewMode: ViewMode;
  selectedModelIndex: number;
  selectedSessionIndex: number;
  modelDetailMetrics: DailyMetrics[];
  modelDetailSessions: SessionMetrics[];
  isPricingLoading: boolean;
  pricingSkeletonFrame: number;
  showParentProviderPricing: boolean;
  pricingService: ReturnType<typeof createPricingService> | null;
  dbPath: string;
  loadVersion: number;

  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSummary: (summary: DashboardSummary | null) => void;
  setModels: (models: ModelMetrics[]) => void;
  setSessions: (sessions: SessionMetrics[]) => void;
  setDailyMetrics: (dailyMetrics: DailyMetrics[]) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedModelIndex: (index: number) => void;
  setSelectedSessionIndex: (index: number) => void;
  setModelDetailMetrics: (metrics: DailyMetrics[]) => void;
  setModelDetailSessions: (sessions: SessionMetrics[]) => void;
  setIsPricingLoading: (loading: boolean) => void;
  setPricingSkeletonFrame: (frame: number) => void;
  setShowParentProviderPricing: (show: boolean) => void;
  toggleShowParentProviderPricing: () => void;
  setPricingService: (service: ReturnType<typeof createPricingService> | null) => void;
  setDbPath: (path: string) => void;
  incrementLoadVersion: () => void;

  loadData: () => Promise<void>;
  loadModelDetail: (modelId: string) => Promise<void>;
  recalculatePricing: () => void;
}

let loadVersionCounter = 0;

export const useAppStore = create<AppState>((set, get) => ({
  isLoading: true,
  error: null,
  summary: null,
  models: [],
  sessions: [],
  dailyMetrics: [],
  activePanel: "models",
  viewMode: "dashboard",
  selectedModelIndex: 0,
  selectedSessionIndex: 0,
  modelDetailMetrics: [],
  modelDetailSessions: [],
  isPricingLoading: false,
  pricingSkeletonFrame: 0,
  showParentProviderPricing: false,
  pricingService: null,
  dbPath: "",
  loadVersion: 0,

  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSummary: (summary) => set({ summary }),
  setModels: (models) => set({ models }),
  setSessions: (sessions) => set({ sessions }),
  setDailyMetrics: (dailyMetrics) => set({ dailyMetrics }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedModelIndex: (selectedModelIndex) => set({ selectedModelIndex }),
  setSelectedSessionIndex: (selectedSessionIndex) => set({ selectedSessionIndex }),
  setModelDetailMetrics: (modelDetailMetrics) => set({ modelDetailMetrics }),
  setModelDetailSessions: (modelDetailSessions) => set({ modelDetailSessions }),
  setIsPricingLoading: (isPricingLoading) => set({ isPricingLoading }),
  setPricingSkeletonFrame: (pricingSkeletonFrame) => set({ pricingSkeletonFrame }),
  setShowParentProviderPricing: (showParentProviderPricing) => set({ showParentProviderPricing }),
  toggleShowParentProviderPricing: () => set((state) => ({ showParentProviderPricing: !state.showParentProviderPricing })),
  setPricingService: (pricingService) => set({ pricingService }),
  setDbPath: (dbPath) => set({ dbPath }),
  incrementLoadVersion: () => set((state) => ({ loadVersion: state.loadVersion + 1 })),

  loadData: async () => {
    const state = get();
    const loadVersion = ++loadVersionCounter;

    set({ isLoading: true, isPricingLoading: false, pricingSkeletonFrame: 0, error: null });

    let db: ReturnType<typeof createDatabase> | null = null;

    try {
      db = createDatabase(state.dbPath);
      const validation = db.validate();

      if (!validation.valid) {
        if (loadVersionCounter !== loadVersion) return;
        set({ error: validation.error || "Invalid database", isLoading: false });
        return;
      }

      const aggregator = new MetricsAggregator(db);
      const baseModelData = aggregator.getModelMetrics();
      const sessionData = aggregator.getSessionMetrics();
      const dailyData = aggregator.getDailyMetrics();
      const summaryData = aggregator.getDashboardSummary();

      if (loadVersionCounter !== loadVersion) return;

      set({
        models: baseModelData,
        sessions: sessionData,
        dailyMetrics: dailyData,
        summary: summaryData,
        isLoading: false,
      });

      const pricingTargets: PricingLookupTarget[] = baseModelData.map((model) => ({
        modelId: model.modelId,
        providerId: model.providerId,
      }));

      if (pricingTargets.length === 0) {
        return;
      }

      set({ isPricingLoading: true });

      const pricingService = createPricingService();
      await pricingService.load(pricingTargets);

      if (loadVersionCounter !== loadVersion) return;

      set({ pricingService });

      const pricedModels = baseModelData.map((model) => {
        const pricing = state.showParentProviderPricing
          ? pricingService.getParentProviderPricing(model.modelId)
          : pricingService.getPricing(model.modelId, model.providerId);

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

      set((state) => ({
        models: pricedModels,
        summary: state.summary
          ? { ...state.summary, totalEstimatedCost }
          : null,
      }));
    } catch (err) {
      if (loadVersionCounter !== loadVersion) return;
      set({ error: err instanceof Error ? err.message : "Unknown error", isLoading: false });
    } finally {
      db?.close();
    }
  },

  loadModelDetail: async (modelId: string) => {
    const state = get();
    try {
      const db = createDatabase(state.dbPath);
      const aggregator = new MetricsAggregator(db);

      const daily = aggregator.getModelDailyMetrics(modelId);
      const topSessions = aggregator.getTopSessionsForModel(modelId, 10);

      set({ modelDetailMetrics: daily, modelDetailSessions: topSessions });

      db.close();
    } catch {
      set({ modelDetailMetrics: [], modelDetailSessions: [] });
    }
  },

  recalculatePricing: () => {
    const state = get();
    const { pricingService, models, showParentProviderPricing } = state;

    if (models.length === 0 || !pricingService) return;

    const pricedModels = models.map((model) => {
      const pricing = showParentProviderPricing
        ? pricingService.getParentProviderPricing(model.modelId)
        : pricingService.getPricing(model.modelId, model.providerId);

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

    set((state) => ({
      models: pricedModels,
      summary: state.summary
        ? { ...state.summary, totalEstimatedCost }
        : null,
    }));
  },
}));
