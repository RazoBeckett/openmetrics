import type { OpenCodeDB } from "../db/database.ts";
import type {
  MessageData,
  ModelMetrics,
  SessionMetrics,
  DailyMetrics,
  DashboardSummary,
  TokenCounts,
} from "../types/index.ts";

function timestampToDateStr(timestamp: string | number): string {
  const ts = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
  return new Date(ts).toISOString().split("T")[0];
}

function timestampToDate(timestamp: string | number): Date {
  const ts = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
  return new Date(ts);
}

function parseMessageData(dataStr: string): MessageData | null {
  try {
    const data = JSON.parse(dataStr);
    return {
      modelID: data.modelID || "unknown",
      providerID: data.providerID || "unknown",
      role: data.role || "unknown",
      tokens: {
        input: data.tokens?.input ?? 0,
        output: data.tokens?.output ?? 0,
        cache: {
          read: data.tokens?.cache?.read ?? 0,
          write: data.tokens?.cache?.write ?? 0,
        },
      },
    };
  } catch {
    return null;
  }
}

function safeTokens(tokens: TokenCounts): TokenCounts {
  return {
    input: tokens.input || 0,
    output: tokens.output || 0,
    cache: {
      read: tokens.cache?.read || 0,
      write: tokens.cache?.write || 0,
    },
  };
}

export class MetricsAggregator {
  private db: OpenCodeDB;
  private pricingLookup: Map<string, { input: number; output: number; cache_read?: number; cache_write?: number }>;

  constructor(db: OpenCodeDB) {
    this.db = db;
    this.pricingLookup = new Map();
  }

  setPricing(modelId: string, pricing: { input: number; output: number; cache_read?: number; cache_write?: number }): void {
    this.pricingLookup.set(modelId, pricing);
  }

  setPricingBulk(pricingMap: Map<string, { input: number; output: number; cache_read?: number; cache_write?: number }>): void {
    this.pricingLookup = pricingMap;
  }

  private calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number,
    cacheWriteTokens: number
  ): { inputCost: number; outputCost: number; totalCost: number } | null {
    const pricing = this.pricingLookup.get(modelId);
    if (!pricing) return null;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const cacheReadCost = pricing.cache_read ? (cacheReadTokens / 1_000_000) * pricing.cache_read : 0;
    const cacheWriteCost = pricing.cache_write ? (cacheWriteTokens / 1_000_000) * pricing.cache_write : 0;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
    };
  }

  getModelMetrics(): ModelMetrics[] {
    const messages = this.db.getAllMessages();
    const modelMap = new Map<string, ModelMetrics>();

    for (const msg of messages) {
      const data = parseMessageData(msg.data);
      if (!data) continue;

      const tokens = safeTokens(data.tokens);
      const key = `${data.providerID}:${data.modelID}`;

      if (!modelMap.has(key)) {
        modelMap.set(key, {
          modelId: data.modelID,
          providerId: data.providerID,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 0,
          messageCount: 0,
          estimatedCost: null,
          inputCost: null,
          outputCost: null,
        });
      }

      const metrics = modelMap.get(key)!;
      metrics.inputTokens += tokens.input;
      metrics.outputTokens += tokens.output;
      metrics.cacheReadTokens += tokens.cache.read;
      metrics.cacheWriteTokens += tokens.cache.write;
      metrics.totalTokens += tokens.input + tokens.output;
      metrics.messageCount += 1;
    }

    const result = Array.from(modelMap.values());
    for (const m of result) {
      const costData = this.calculateCost(
        m.modelId,
        m.inputTokens,
        m.outputTokens,
        m.cacheReadTokens,
        m.cacheWriteTokens
      );
      if (costData) {
        m.estimatedCost = costData.totalCost;
        m.inputCost = costData.inputCost;
        m.outputCost = costData.outputCost;
      }
    }

    return result.sort((a, b) => b.totalTokens - a.totalTokens);
  }

  getSessionMetrics(): SessionMetrics[] {
    const messages = this.db.getAllMessages();
    const sessions = this.db.getAllSessions();
    const sessionTitleMap = new Map<string, string>();
    
    for (const s of sessions) {
      sessionTitleMap.set(s.id, s.title || s.id.slice(0, 8));
    }

    const sessionMap = new Map<string, SessionMetrics>();

    for (const msg of messages) {
      const data = parseMessageData(msg.data);
      if (!data) continue;

      const tokens = safeTokens(data.tokens);
      const sessionId = msg.session_id;

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          sessionId,
          title: sessionTitleMap.get(sessionId) || sessionId.slice(0, 8),
          messageCount: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          lastUpdated: timestampToDate(msg.time_updated || msg.time_created),
          estimatedCost: null,
        });
      }

      const metrics = sessionMap.get(sessionId)!;
      metrics.inputTokens += tokens.input;
      metrics.outputTokens += tokens.output;
      metrics.totalTokens += tokens.input + tokens.output;
      metrics.messageCount += 1;

      const msgTime = timestampToDate(msg.time_updated || msg.time_created);
      if (msgTime > metrics.lastUpdated) {
        metrics.lastUpdated = msgTime;
      }
    }

    return Array.from(sessionMap.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }

  getDailyMetrics(): DailyMetrics[] {
    const messages = this.db.getAllMessages();
    const dailyMap = new Map<string, DailyMetrics>();

    for (const msg of messages) {
      const data = parseMessageData(msg.data);
      if (!data) continue;

      const tokens = safeTokens(data.tokens);
      const date = timestampToDateStr(msg.time_created);

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
      }

      const metrics = dailyMap.get(date)!;
      metrics.inputTokens += tokens.input;
      metrics.outputTokens += tokens.output;
      metrics.totalTokens += tokens.input + tokens.output;
      metrics.messageCount += 1;
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  getDashboardSummary(): DashboardSummary {
    const modelMetrics = this.getModelMetrics();
    const sessionMetrics = this.getSessionMetrics();

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheWriteTokens = 0;
    let totalEstimatedCost = 0;

    const providers = new Set<string>();

    for (const m of modelMetrics) {
      totalInputTokens += m.inputTokens;
      totalOutputTokens += m.outputTokens;
      totalCacheReadTokens += m.cacheReadTokens;
      totalCacheWriteTokens += m.cacheWriteTokens;
      providers.add(m.providerId);

      if (m.estimatedCost !== null) {
        totalEstimatedCost += m.estimatedCost;
      }
    }

    let totalMessages = 0;
    for (const s of sessionMetrics) {
      totalMessages += s.messageCount;
    }

    return {
      totalMessages,
      totalSessions: sessionMetrics.length,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalEstimatedCost,
      uniqueModels: modelMetrics.length,
      uniqueProviders: providers.size,
    };
  }

  getModelDailyMetrics(modelId: string): DailyMetrics[] {
    const messages = this.db.getAllMessages();
    const dailyMap = new Map<string, DailyMetrics>();

    for (const msg of messages) {
      const data = parseMessageData(msg.data);
      if (!data || data.modelID !== modelId) continue;

      const tokens = safeTokens(data.tokens);
      const date = timestampToDateStr(msg.time_created);

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
      }

      const metrics = dailyMap.get(date)!;
      metrics.inputTokens += tokens.input;
      metrics.outputTokens += tokens.output;
      metrics.totalTokens += tokens.input + tokens.output;
      metrics.messageCount += 1;
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  getTopSessionsForModel(modelId: string, limit = 10): SessionMetrics[] {
    const messages = this.db.getAllMessages();
    const sessions = this.db.getAllSessions();
    const sessionTitleMap = new Map<string, string>();

    for (const s of sessions) {
      sessionTitleMap.set(s.id, s.title || s.id.slice(0, 8));
    }

    const sessionMap = new Map<string, SessionMetrics>();

    for (const msg of messages) {
      const data = parseMessageData(msg.data);
      if (!data || data.modelID !== modelId) continue;

      const tokens = safeTokens(data.tokens);
      const sessionId = msg.session_id;

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          sessionId,
          title: sessionTitleMap.get(sessionId) || sessionId.slice(0, 8),
          messageCount: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          lastUpdated: timestampToDate(msg.time_updated || msg.time_created),
          estimatedCost: null,
        });
      }

      const metrics = sessionMap.get(sessionId)!;
      metrics.inputTokens += tokens.input;
      metrics.outputTokens += tokens.output;
      metrics.totalTokens += tokens.input + tokens.output;
      metrics.messageCount += 1;
    }

    return Array.from(sessionMap.values())
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, limit);
  }
}

export function createAggregator(db: OpenCodeDB): MetricsAggregator {
  return new MetricsAggregator(db);
}
