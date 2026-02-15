import { homedir } from "os";
import { join } from "path";
import { fetchModels } from "tokenlens";
import type { ModelCatalog, ProviderInfo, ProviderModel } from "tokenlens";
import type { ModelPricing } from "../types/index.ts";

const CACHE_DIR = join(homedir(), ".openmetrics");
const CACHE_FILE = join(CACHE_DIR, "pricing-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PricingLookupTarget {
  modelId: string;
  providerId?: string;
}

interface PricingCacheData {
  timestamp: number;
  ttl: number;
  data: ModelCatalog;
}

async function ensureCacheDir(): Promise<void> {
  const dir = Bun.file(CACHE_DIR);
  if (!(await dir.exists())) {
    await Bun.write(join(CACHE_DIR, ".keep"), "");
  }
}

async function readCache(): Promise<PricingCacheData | null> {
  try {
    const file = Bun.file(CACHE_FILE);
    if (!(await file.exists())) return null;

    const content = await file.text();
    const cache = JSON.parse(content) as PricingCacheData;

    if (Date.now() - cache.timestamp > cache.ttl) {
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

async function writeCache(data: ModelCatalog): Promise<void> {
  await ensureCacheDir();
  const cache: PricingCacheData = {
    timestamp: Date.now(),
    ttl: CACHE_TTL_MS,
    data,
  };
  await Bun.write(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function normalizeDotsToDashes(id: string): string {
  return id.replace(/\./g, "-");
}

export function getParentProvider(modelId: string): string | null {
  const normalized = modelId.toLowerCase().trim();

  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3")) return "openai";
  if (normalized.includes("gemini")) return "google";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("mistral") || normalized.includes("ministral")) return "mistral";
  if (normalized.includes("kimi")) return "moonshotai";
  if (normalized.includes("glm")) return "zai";
  if (normalized.includes("grok")) return "xai";
  if (normalized.includes("command")) return "cohere";
  if (normalized.includes("nova")) return "amazon-bedrock";
  if (normalized.includes("qwen") || normalized.includes("qwq")) return "alibaba";
  if (normalized.includes("llama")) return "meta";
  if (normalized.includes("minimax")) return "minimax";

  return null;
}

function toTokenlensId(modelId: string, providerId?: string): string | null {
  const normalized = normalizeDotsToDashes(modelId.toLowerCase().trim());

  const knownMappings: Record<string, { provider: string; model: string }> = {
    "claude-sonnet-4-5": { provider: "anthropic", model: "claude-sonnet-4-5" },
    "claude-sonnet-4.5": { provider: "anthropic", model: "claude-sonnet-4-5" },
    "claude-sonnet-4": { provider: "anthropic", model: "claude-sonnet-4-20250514" },
    "claude-opus-4-5": { provider: "anthropic", model: "claude-opus-4-5" },
    "claude-opus-4.5": { provider: "anthropic", model: "claude-opus-4-5" },
    "claude-opus-4": { provider: "anthropic", model: "claude-opus-4-20250514" },
    "claude-haiku-4-5": { provider: "anthropic", model: "claude-haiku-4-5" },
    "claude-haiku-4.5": { provider: "anthropic", model: "claude-haiku-4-5" },
    "claude-3-5-sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    "claude-3.5-sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
    "claude-3-5-haiku": { provider: "anthropic", model: "claude-3-5-haiku-latest" },
    "claude-3.5-haiku": { provider: "anthropic", model: "claude-3-5-haiku-latest" },
    "claude-3-opus": { provider: "anthropic", model: "claude-3-opus-latest" },
    "gpt-4o": { provider: "openai", model: "gpt-4o" },
    "gpt-4o-mini": { provider: "openai", model: "gpt-4o-mini" },
    "gpt-4-turbo": { provider: "openai", model: "gpt-4-turbo" },
    "gpt-4": { provider: "openai", model: "gpt-4" },
    "gpt-3-5-turbo": { provider: "openai", model: "gpt-3.5-turbo" },
    "gpt-3.5-turbo": { provider: "openai", model: "gpt-3.5-turbo" },
    "gpt-4-1": { provider: "openai", model: "gpt-4.1" },
    "gpt-4.1": { provider: "openai", model: "gpt-4.1" },
    "gpt-4-1-mini": { provider: "openai", model: "gpt-4.1-mini" },
    "gpt-4.1-mini": { provider: "openai", model: "gpt-4.1-mini" },
    "gpt-4-1-nano": { provider: "openai", model: "gpt-4.1-nano" },
    "gpt-4.1-nano": { provider: "openai", model: "gpt-4.1-nano" },
    "o3-mini": { provider: "openai", model: "o3-mini" },
    "o1": { provider: "openai", model: "o1" },
    "o1-mini": { provider: "openai", model: "o1-mini" },
  };

  if (providerId) {
    const provider = providerId.toLowerCase().trim();

    if (provider.includes("anthropic") || provider.includes("claude")) {
      const mapping = knownMappings[normalized];
      if (mapping && mapping.provider === "anthropic") {
        return `${mapping.provider}:${mapping.model}`;
      }
      return `anthropic:${normalized}`;
    }

    if (provider.includes("openai") || provider.includes("gpt")) {
      const mapping = knownMappings[normalized];
      if (mapping && mapping.provider === "openai") {
        return `${mapping.provider}:${mapping.model}`;
      }
      return `openai:${normalized}`;
    }

    if (provider.includes("google") || provider.includes("gemini")) {
      return `google:${normalized}`;
    }

    if (provider.includes("deepseek")) {
      return `deepseek:${normalized}`;
    }

    if (provider.includes("mistral")) {
      return `mistral:${normalized}`;
    }

    if (provider.includes("groq")) {
      return `groq:${normalized}`;
    }

    if (provider.includes("perplexity")) {
      return `perplexity:${normalized}`;
    }

    if (provider.includes("cohere")) {
      return `cohere:${normalized}`;
    }

    if (provider.includes("xai") || provider.includes("grok")) {
      return `xai:${normalized}`;
    }

    return `${provider}:${normalized}`;
  }

  const mapping = knownMappings[normalized];
  if (mapping) {
    return `${mapping.provider}:${mapping.model}`;
  }

  if (normalized.includes("claude")) {
    return `anthropic:${normalized}`;
  }

  if (normalized.includes("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return `openai:${normalized}`;
  }

  if (normalized.includes("gemini")) {
    return `google:${normalized}`;
  }

  return null;
}

export async function fetchPricingData(): Promise<ModelCatalog> {
  const cached = await readCache();
  if (cached) {
    return cached.data;
  }

  try {
    const catalog = await fetchModels();
    await writeCache(catalog);
    return catalog;
  } catch (err) {
    console.error("Failed to fetch pricing data from tokenlens:", err);
    return {};
  }
}

function extractPricing(model: ProviderModel | undefined): ModelPricing | null {
  if (!model || !model.cost) return null;

  return {
    input: model.cost.input || 0,
    output: model.cost.output || 0,
    cache_read: model.cost.cache_read,
    cache_write: model.cost.cache_write,
  };
}

function generateModelIdVariants(modelId: string): string[] {
  const variants = new Set<string>();
  variants.add(modelId);

  const dashesVersion = modelId.replace(/\./g, "-");
  if (dashesVersion !== modelId) {
    variants.add(dashesVersion);
  }

  const dotsVersion = modelId.replace(/(\d)-(\d)/g, "$1.$2");
  if (dotsVersion !== modelId) {
    variants.add(dotsVersion);
  }

  return Array.from(variants);
}

function buildRequestedModelKeySet(targets: PricingLookupTarget[]): Set<string> {
  const keys = new Set<string>();

  for (const target of targets) {
    const tokenlensId = toTokenlensId(target.modelId, target.providerId);
    if (tokenlensId) {
      keys.add(tokenlensId);
      const [provider, model] = tokenlensId.split(":");
      if (provider && model) {
        keys.add(`${provider}:${model}`);
        keys.add(model);
        generateModelIdVariants(model).forEach((v) => keys.add(v));
        generateModelIdVariants(`${provider}/${model}`).forEach((v) => keys.add(v));
      }
    }

    generateModelIdVariants(target.modelId).forEach((v) => keys.add(v));
    if (target.providerId) {
      generateModelIdVariants(`${target.providerId}/${target.modelId}`).forEach((v) =>
        keys.add(v)
      );
    }
  }

  return keys;
}

export function buildPricingMap(
  catalog: ModelCatalog,
  requestedModelKeys?: Set<string>
): Map<string, ModelPricing> {
  const map = new Map<string, ModelPricing>();

  for (const [providerId, provider] of Object.entries(catalog)) {
    if (!provider.models) continue;

    for (const [modelId, modelInfo] of Object.entries(provider.models)) {
      const pricing = extractPricing(modelInfo);
      if (!pricing) continue;

      const tokenlensId = `${providerId}:${modelId}`;
      const modelVariants = generateModelIdVariants(modelId);
      const withProviderVariants = generateModelIdVariants(`${providerId}/${modelId}`);

      if (requestedModelKeys) {
        let shouldInclude = false;
        if (requestedModelKeys.has(tokenlensId)) shouldInclude = true;
        for (const variant of [...modelVariants, ...withProviderVariants]) {
          if (requestedModelKeys.has(variant)) {
            shouldInclude = true;
            break;
          }
        }
        if (!shouldInclude) continue;
      }

      map.set(tokenlensId, pricing);
      for (const variant of modelVariants) {
        map.set(variant, pricing);
        map.set(`${providerId}:${variant}`, pricing);
      }
      for (const variant of withProviderVariants) {
        map.set(variant, pricing);
      }
    }
  }

  return map;
}

export function lookupPricing(
  pricingMap: Map<string, ModelPricing>,
  modelId: string,
  providerId?: string
): ModelPricing | null {
  const tokenlensId = toTokenlensId(modelId, providerId);
  if (tokenlensId && pricingMap.has(tokenlensId)) {
    return pricingMap.get(tokenlensId)!;
  }

  const lookupKeys: string[] = [];

  if (providerId) {
    const withProviderVariants = generateModelIdVariants(`${providerId}/${modelId}`);
    lookupKeys.push(...withProviderVariants);
  }

  const modelVariants = generateModelIdVariants(modelId);
  lookupKeys.push(...modelVariants);

  for (const key of lookupKeys) {
    const result = pricingMap.get(key);
    if (result) return result;
  }

  return null;
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

  async load(targets?: PricingLookupTarget[]): Promise<void> {
    if (this.loaded) return;

    try {
      const catalog = await fetchPricingData();
      const requestedModelKeys =
        targets && targets.length > 0 ? buildRequestedModelKeySet(targets) : undefined;
      this.pricingMap = buildPricingMap(catalog, requestedModelKeys);
      this.loaded = true;
    } catch (err) {
      console.error("Failed to load pricing data:", err);
      this.loaded = true;
    }
  }

  getPricing(modelId: string, providerId?: string): ModelPricing | null {
    return lookupPricing(this.pricingMap, modelId, providerId);
  }

  getParentProviderPricing(modelId: string): ModelPricing | null {
    const parentProvider = getParentProvider(modelId);
    if (!parentProvider) return null;

    const normalized = normalizeDotsToDashes(modelId.toLowerCase().trim());

    const knownMappings: Record<string, string> = {
      "claude-sonnet-4-5": "claude-sonnet-4-5",
      "claude-sonnet-4": "claude-sonnet-4-20250514",
      "claude-opus-4-5": "claude-opus-4-5",
      "claude-opus-4": "claude-opus-4-20250514",
      "claude-haiku-4-5": "claude-haiku-4-5",
      "claude-3-5-sonnet": "claude-3-5-sonnet-latest",
      "claude-3-5-haiku": "claude-3-5-haiku-latest",
      "claude-3-opus": "claude-3-opus-latest",
      "gpt-4o": "gpt-4o",
      "gpt-4o-mini": "gpt-4o-mini",
      "gpt-4-turbo": "gpt-4-turbo",
      "gpt-4": "gpt-4",
      "gpt-3-5-turbo": "gpt-3.5-turbo",
      "gpt-4-1": "gpt-4.1",
      "gpt-4-1-mini": "gpt-4.1-mini",
      "gpt-4-1-nano": "gpt-4.1-nano",
      "o3-mini": "o3-mini",
      "o1": "o1",
      "o1-mini": "o1-mini",
      "kimi-k2-5": "kimi-k2.5",
      "kimi-k2": "kimi-k2",
      "kimi-k2.5": "kimi-k2.5",
      "glm-4-7": "glm-4.7",
      "glm-4-5": "glm-4.5",
      "glm-4.7": "glm-4.7",
      "glm-4.5": "glm-4.5",
      "minimax-m2-1": "MiniMax-M2.1",
      "minimax-m2": "MiniMax-M2",
      "MiniMax-M2-1": "MiniMax-M2.1",
      "MiniMax-M2": "MiniMax-M2",
    };

    const mappedModel = knownMappings[normalized];
    if (mappedModel) {
      const pricing = this.pricingMap.get(`${parentProvider}:${mappedModel}`);
      if (pricing) return pricing;
    }

    const strippedVariants = this.generateStrippedVariants(normalized);
    for (const variant of strippedVariants) {
      const mapped = knownMappings[variant];
      if (mapped) {
        const pricing = this.pricingMap.get(`${parentProvider}:${mapped}`);
        if (pricing) return pricing;
      }

      const pricing = this.pricingMap.get(`${parentProvider}:${variant}`);
      if (pricing) return pricing;
    }

    const variants = generateModelIdVariants(normalized);
    for (const variant of variants) {
      const pricing = this.pricingMap.get(`${parentProvider}:${variant}`);
      if (pricing) return pricing;
    }

    return null;
  }

  private generateStrippedVariants(modelId: string): string[] {
    const variants = new Set<string>();
    variants.add(modelId);

    const suffixesToStrip = [
      "-free",
      "-preview",
      "-thinking",
      "-fast",
      "-latest",
      "-max",
      "-mini",
      "-nano",
      ":free",
      ":latest",
    ];

    let stripped = modelId;
    for (const suffix of suffixesToStrip) {
      if (stripped.endsWith(suffix)) {
        stripped = stripped.slice(0, -suffix.length);
        variants.add(stripped);
      }
    }

    const prefixesToStrip = ["openai/", "moonshotai/", "qwen/"];
    for (const prefix of prefixesToStrip) {
      if (stripped.startsWith(prefix)) {
        const withoutPrefix = stripped.slice(prefix.length);
        variants.add(withoutPrefix);
        variants.add(normalizeDotsToDashes(withoutPrefix));
      }
    }

    const withDots = stripped.replace(/-/g, ".");
    if (withDots !== stripped) {
      variants.add(withDots);
    }

    const capitalized = stripped
      .split("-")
      .map((part, i) => {
        if (i === 0 && part === "kimi") return "kimi";
        if (i === 0 && part === "glm") return "glm";
        if (part === "m2") return "M2";
        if (part === "m2.1" || part === "m2-1") return "M2.1";
        if (part === "m2.5" || part === "m2-5") return "M2.5";
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join("-");
    variants.add(capitalized);

    const capitalizedWithDots = capitalized.replace(/-/g, ".");
    if (capitalizedWithDots !== capitalized) {
      variants.add(capitalizedWithDots);
    }

    return Array.from(variants);
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
