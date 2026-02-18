package pricing

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const (
	// ModelCostMapURL is the URL to LiteLLM's pricing data
	ModelCostMapURL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
	// CacheDuration is how long to cache pricing data
	CacheDuration = 1 * time.Hour
)

// ModelPricing contains pricing information for a model
type ModelPricing struct {
	InputCostPerToken           float64 `json:"input_cost_per_token"`
	OutputCostPerToken          float64 `json:"output_cost_per_token"`
	InputCostPerTokenAbove128k  float64 `json:"input_cost_per_token_above_128k_tokens"`
	InputCostPerTokenAbove200k  float64 `json:"input_cost_per_token_above_200k_tokens"`
	OutputCostPerTokenAbove128k float64 `json:"output_cost_per_token_above_128k_tokens"`
	OutputCostPerTokenAbove200k float64 `json:"output_cost_per_token_above_200k_tokens"`
	CacheCreationInputTokenCost float64 `json:"cache_creation_input_token_cost"`
	CacheReadInputTokenCost     float64 `json:"cache_read_input_token_cost"`
	InputCostPerTokenPriority   float64 `json:"input_cost_per_token_priority"`
	InputCostPerTokenBatches    float64 `json:"input_cost_per_token_batches"`
	OutputCostPerTokenPriority  float64 `json:"output_cost_per_token_priority"`
	OutputCostPerTokenBatches   float64 `json:"output_cost_per_token_batches"`
	SupportsPromptCaching       bool    `json:"supports_prompt_caching"`
	SupportsServiceTier         bool    `json:"supports_service_tier"`
	MaxInputTokens              int     `json:"max_input_tokens"`
	MaxOutputTokens             int     `json:"max_output_tokens"`
	LiteLLMProvider             string  `json:"litellm_provider"`
}

// PricingService manages model pricing data
type PricingService struct {
	mu          sync.RWMutex
	pricing     map[string]ModelPricing
	lastFetched time.Time
	httpClient  *http.Client
}

// NewPricingService creates a new pricing service
func NewPricingService() *PricingService {
	return &PricingService{
		pricing: make(map[string]ModelPricing),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// FetchPricing fetches the latest pricing data from LiteLLM
func (p *PricingService) FetchPricing() error {
	resp, err := p.httpClient.Get(ModelCostMapURL)
	if err != nil {
		return fmt.Errorf("failed to fetch pricing data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var pricing map[string]ModelPricing
	if err := json.NewDecoder(resp.Body).Decode(&pricing); err != nil {
		return fmt.Errorf("failed to decode pricing data: %w", err)
	}

	p.mu.Lock()
	p.pricing = pricing
	p.lastFetched = time.Now()
	p.mu.Unlock()

	return nil
}

// GetPricing returns pricing for a specific model
func (p *PricingService) GetPricing(modelID string) (ModelPricing, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Try exact match first
	if pricing, ok := p.pricing[modelID]; ok {
		return pricing, true
	}

	// Try common model name variations
	aliases := []string{
		modelID,
		"openai/" + modelID,
		"anthropic/" + modelID,
	}

	// Map common model IDs to LiteLLM format
	switch modelID {
	case "claude-sonnet-4.5":
		aliases = append(aliases, "claude-sonnet-4-20250514", "anthropic/claude-sonnet-4-20250514")
	case "gpt-4o":
		aliases = append(aliases, "openai/gpt-4o")
	case "gpt-4":
		aliases = append(aliases, "openai/gpt-4")
	}

	for _, alias := range aliases {
		if pricing, ok := p.pricing[alias]; ok {
			return pricing, true
		}
	}

	return ModelPricing{}, false
}

// CalculateCost calculates the cost for a given token usage
func (p *PricingService) CalculateCost(modelID string, inputTokens, outputTokens, cachedTokens int64) float64 {
	pricing, ok := p.GetPricing(modelID)
	if !ok {
		return 0
	}

	var inputCost, outputCost float64

	// Calculate input cost with tiered pricing
	inputTokensF := float64(inputTokens)
	if inputTokens > 200000 && pricing.InputCostPerTokenAbove200k > 0 {
		inputCost = inputTokensF * pricing.InputCostPerTokenAbove200k
	} else if inputTokens > 128000 && pricing.InputCostPerTokenAbove128k > 0 {
		inputCost = inputTokensF * pricing.InputCostPerTokenAbove128k
	} else if pricing.InputCostPerToken > 0 {
		inputCost = inputTokensF * pricing.InputCostPerToken
	}

	// Apply cached token discount
	if cachedTokens > 0 && pricing.CacheReadInputTokenCost > 0 {
		// Subtract the regular cost for cached tokens and add the discounted cost
		cachedTokensF := float64(cachedTokens)
		regularCost := cachedTokensF * pricing.InputCostPerToken
		cachedCost := cachedTokensF * pricing.CacheReadInputTokenCost
		inputCost = inputCost - regularCost + cachedCost
	}

	// Calculate output cost with tiered pricing
	outputTokensF := float64(outputTokens)
	if outputTokens > 200000 && pricing.OutputCostPerTokenAbove200k > 0 {
		outputCost = outputTokensF * pricing.OutputCostPerTokenAbove200k
	} else if outputTokens > 128000 && pricing.OutputCostPerTokenAbove128k > 0 {
		outputCost = outputTokensF * pricing.OutputCostPerTokenAbove128k
	} else if pricing.OutputCostPerToken > 0 {
		outputCost = outputTokensF * pricing.OutputCostPerToken
	}

	return inputCost + outputCost
}

// NeedsRefresh returns true if pricing data needs to be refreshed
func (p *PricingService) NeedsRefresh() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return time.Since(p.lastFetched) > CacheDuration || len(p.pricing) == 0
}

// GetModelCount returns the number of models with pricing data
func (p *PricingService) GetModelCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return len(p.pricing)
}

// FormatCost formats a cost value for display
func FormatCost(cost float64) string {
	if cost == 0 {
		return "$0.00"
	}
	if cost < 0.01 {
		return fmt.Sprintf("$%.4f", cost)
	}
	return fmt.Sprintf("$%.2f", cost)
}

// FormatTokens formats token count for display (in millions)
func FormatTokens(tokens int64) string {
	millions := float64(tokens) / 1_000_000
	if millions >= 1 {
		return fmt.Sprintf("%.1fM", millions)
	}
	thousands := float64(tokens) / 1_000
	if thousands >= 1 {
		return fmt.Sprintf("%.1fK", thousands)
	}
	return fmt.Sprintf("%d", tokens)
}
