import { homedir } from "os";
import { join } from "path";
import type { ModelsDevResponse, PricingCache, ModelPricing } from "../types/index.ts";

const MODELS_DEV_API_URL = "https://models.dev/api.json";
const CACHE_DIR = join(homedir(), ".openmetrics");
const CACHE_FILE = join(CACHE_DIR, "pricing-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function ensureCacheDir(): Promise<void> {
  const dir = Bun.file(CACHE_DIR);
  if (!(await dir.exists())) {
    await Bun.write(join(CACHE_DIR, ".keep"), "");
  }
}

async function readCache(): Promise<PricingCache | null> {
  try {
    const file = Bun.file(CACHE_FILE);
    if (!(await file.exists())) return null;

    const content = await file.text();
    const cache: PricingCache = JSON.parse(content);

    if (Date.now() - cache.timestamp > cache.ttl) {
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

async function writeCache(data: ModelsDevResponse): Promise<void> {
  await ensureCacheDir();
  const cache: PricingCache = {
    timestamp: Date.now(),
    ttl: CACHE_TTL_MS,
    data,
  };
  await Bun.write(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function fetchPricingData(): Promise<ModelsDevResponse> {
  const cached = await readCache();
  if (cached) {
    return cached.data;
  }

  const response = await fetch(MODELS_DEV_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Models.dev: ${response.status}`);
  }

  const data = (await response.json()) as ModelsDevResponse;
  await writeCache(data);
  return data;
}

function normalizeModelId(modelId: string): string {
  return modelId.replace(/\./g, "-");
}

export function buildPricingMap(
  data: ModelsDevResponse
): Map<string, ModelPricing> {
  const map = new Map<string, ModelPricing>();

  for (const [providerId, provider] of Object.entries(data)) {
    if (!provider.models) continue;

    for (const [modelId, modelInfo] of Object.entries(provider.models)) {
      if (!modelInfo.cost) continue;

      const pricing: ModelPricing = {
        input: modelInfo.cost.input || 0,
        output: modelInfo.cost.output || 0,
        cache_read: modelInfo.cost.cache_read,
        cache_write: modelInfo.cost.cache_write,
      };

      map.set(modelId, pricing);
      map.set(normalizeModelId(modelId), pricing);
      
      const withProvider = `${providerId}/${modelId}`;
      map.set(withProvider, pricing);
      map.set(normalizeModelId(withProvider), pricing);
    }
  }

  return map;
}

export function lookupPricing(
  pricingMap: Map<string, ModelPricing>,
  modelId: string,
  providerId?: string
): ModelPricing | null {
  if (providerId) {
    const withProvider = `${providerId}/${modelId}`;
    const result = pricingMap.get(withProvider) || pricingMap.get(normalizeModelId(withProvider));
    if (result) return result;
  }

  return pricingMap.get(modelId) || pricingMap.get(normalizeModelId(modelId)) || null;
}

export function calculateTokenCost(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = pricing.cache_read
    ? (cacheReadTokens / 1_000_000) * pricing.cache_read
    : 0;
  const cacheWriteCost = pricing.cache_write
    ? (cacheWriteTokens / 1_000_000) * pricing.cache_write
    : 0;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export class PricingService {
  private pricingMap: Map<string, ModelPricing> = new Map();
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await fetchPricingData();
      this.pricingMap = buildPricingMap(data);
      this.loaded = true;
    } catch (err) {
      console.error("Failed to load pricing data:", err);
      this.loaded = true;
    }
  }

  getPricing(modelId: string, providerId?: string): ModelPricing | null {
    return lookupPricing(this.pricingMap, modelId, providerId);
  }

  getPricingMap(): Map<string, ModelPricing> {
    return this.pricingMap;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export function createPricingService(): PricingService {
  return new PricingService();
}
