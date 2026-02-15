export interface MessageRow {
  id: string;
  session_id: string;
  time_created: string;
  time_updated: string;
  data: string;
}

export interface SessionRow {
  id: string;
  project_id: string;
  title: string;
  directory: string;
  time_created: string;
  time_updated: string;
}

export interface TokenCounts {
  input: number;
  output: number;
  cache: {
    read: number;
    write: number;
  };
}

export interface MessageData {
  modelID: string;
  providerID: string;
  role: string;
  tokens: TokenCounts;
}

export interface ModelMetrics {
  modelId: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  messageCount: number;
  estimatedCost: number | null;
  inputCost: number | null;
  outputCost: number | null;
}

export interface SessionMetrics {
  sessionId: string;
  title: string;
  messageCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  lastUpdated: Date;
  estimatedCost: number | null;
}

export interface DailyMetrics {
  date: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface DashboardSummary {
  totalMessages: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalTokens: number;
  totalEstimatedCost: number;
  uniqueModels: number;
  uniqueProviders: number;
}

export interface ModelPricing {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
}

export interface ModelInfo {
  name: string;
  description?: string;
  context_length?: number;
  cost?: ModelPricing;
}

export interface ProviderInfo {
  name: string;
  models: Record<string, ModelInfo>;
}

export type ModelsDevResponse = Record<string, ProviderInfo>;

export interface PricingCache {
  timestamp: number;
  ttl: number;
  data: ModelsDevResponse;
}

export type ActivePanel = 'models' | 'sessions' | 'charts';

export type ViewMode = 'dashboard' | 'model-detail';

export interface ModelDetailData {
  modelId: string;
  providerId: string;
  metrics: ModelMetrics;
  dailyMetrics: DailyMetrics[];
  topSessions: SessionMetrics[];
}

export interface AppState {
  dbPath: string;
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
  modelDetail: ModelDetailData | null;
}

export interface ModelAggregationRow {
  model_id: string;
  provider_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  message_count: number;
}

export interface SessionAggregationRow {
  session_id: string;
  title: string;
  input_tokens: number;
  output_tokens: number;
  message_count: number;
  last_updated: string;
}

export interface DailyAggregationRow {
  date: string;
  input_tokens: number;
  output_tokens: number;
  message_count: number;
}
