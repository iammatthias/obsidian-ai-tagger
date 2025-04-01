import { AIExcerptProvider, AIExcerptSettings, LLMProvider } from "../types";
import { ClaudeProvider } from "./claude-provider";
import { OpenAIProvider } from "./openai-provider";

interface FallbackResult {
	provider: AIExcerptProvider | null;
	fallbackType: LLMProvider | null;
	needsConfiguration: boolean;
	success: boolean;
}

/**
 * Factory for creating AI providers based on plugin settings
 *
 * This factory follows the Factory design pattern to create and configure
 * the appropriate AI provider based on user settings.
 */
export class ProviderFactory {
	// Track failed provider attempts to implement cooldown periods
	private static providerCooldowns: Record<string, number> = {};
	private static cooldownDuration: number = 60000; // 1 minute cooldown after failures
	private static activeProviders: Map<
		string,
		{
			provider: AIExcerptProvider;
			lastUsed: number;
			id: string;
		}
	> = new Map();
	private static maxActiveProviders: number = 2; // Maximum concurrent provider instances
	private static cleanupInterval: NodeJS.Timeout | null = null;
	private static maxProviderIdleTime: number = 5 * 60 * 1000; // 5 minutes before cleanup
	private static failedProviders: Set<LLMProvider> = new Set();

	/**
	 * Initialize the provider management system with automatic cleanup
	 */
	static initialize(): void {
		// Set up automatic provider cleanup every minute
		if (!this.cleanupInterval) {
			this.cleanupInterval = setInterval(() => {
				this.cleanupIdleProviders();
			}, 60000); // Check every minute
		}
	}

	/**
	 * Clean up provider management when plugin is unloaded
	 */
	static shutdown(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		// Release all providers
		for (const [id, providerData] of this.activeProviders.entries()) {
			this.activeProviders.delete(id);
			console.log(`Released provider ${id} during shutdown`);
		}

		// Clear all cooldowns
		this.providerCooldowns = {};
	}

	/**
	 * Remove idle providers that haven't been used recently
	 */
	private static cleanupIdleProviders(): void {
		const now = Date.now();
		const expiredIds: string[] = [];

		// Find providers that have been idle too long
		for (const [id, providerData] of this.activeProviders.entries()) {
			const idleTime = now - providerData.lastUsed;
			if (idleTime > this.maxProviderIdleTime) {
				expiredIds.push(id);
			}
		}

		// Clean up expired providers
		for (const id of expiredIds) {
			this.activeProviders.delete(id);
			console.log(
				`Auto-released idle provider ${id} after ${
					this.maxProviderIdleTime / 1000
				} seconds`
			);
		}
	}

	/**
	 * Check if a provider is in cooldown period after repeated failures
	 * @private
	 */
	private static isProviderInCooldown(provider: LLMProvider): boolean {
		const cooldownUntil = this.providerCooldowns[provider];
		if (cooldownUntil && Date.now() < cooldownUntil) {
			return true;
		}
		return false;
	}

	/**
	 * Put a provider into cooldown after repeated failures
	 * @private
	 */
	private static setProviderCooldown(provider: LLMProvider): void {
		this.providerCooldowns[provider] = Date.now() + this.cooldownDuration;
		console.log(
			`${provider} provider put in cooldown until ${new Date(
				this.providerCooldowns[provider]
			).toISOString()}`
		);
	}

	/**
	 * Clear a provider from cooldown
	 * @private
	 */
	private static clearProviderCooldown(provider: LLMProvider): void {
		delete this.providerCooldowns[provider];
	}

	/**
	 * Creates and returns the appropriate AI provider based on settings
	 *
	 * @param settings - The plugin settings containing provider choice and API keys
	 * @returns An initialized AI provider or null if configuration is invalid
	 */
	static createProvider(
		settings: AIExcerptSettings
	): AIExcerptProvider | null {
		try {
			// Check if provider is marked as failed
			if (this.failedProviders.has(settings.provider)) {
				return null;
			}

			// Check if the requested provider is in cooldown
			if (this.isProviderInCooldown(settings.provider)) {
				console.warn(
					`${settings.provider} is in cooldown period due to previous failures. Trying fallback provider.`
				);
				const fallbackResult = this.createFallbackProvider(
					settings,
					settings.provider
				);
				if (fallbackResult.provider) {
					return fallbackResult.provider;
				}
			}

			// Check if we already have too many active providers
			if (this.activeProviders.size >= this.maxActiveProviders) {
				console.warn(
					`Maximum number of active providers (${this.maxActiveProviders}) reached. Reusing an existing provider.`
				);
				// Instead of creating a new instance, return an existing one to limit concurrent requests
				const existingProvider = this.getExistingProvider(
					settings.provider
				);
				if (existingProvider) {
					return existingProvider;
				}

				// If no provider of requested type is available, clean up the oldest one
				this.cleanupOldestProvider();
			}

			// Generate a unique ID for the provider instance
			const providerId = this.getProviderId(settings);

			switch (settings.provider) {
				case LLMProvider.CLAUDE:
					if (!settings.claudeApiKey) {
						console.error("Claude API key not configured");
						return null;
					}

					console.log(
						`Creating Claude provider with model: ${settings.claudeModel} and prompt type: ${settings.promptType}`
					);
					const claudeProvider = new ClaudeProvider(
						settings.claudeApiKey,
						settings.claudeModel,
						false, // useStreaming
						settings.promptType
					);

					// Store the provider for reuse
					this.activeProviders.set(providerId, {
						provider: claudeProvider,
						lastUsed: Date.now(),
						id: providerId,
					});
					return claudeProvider;

				case LLMProvider.OPENAI:
					if (!settings.openaiApiKey) {
						console.error("OpenAI API key not configured");
						return null;
					}

					console.log(
						`Creating OpenAI provider with model: ${settings.openaiModel} and prompt type: ${settings.promptType}`
					);
					const openaiProvider = new OpenAIProvider(
						settings.openaiApiKey,
						settings.openaiModel,
						settings.promptType
					);

					// Store the provider for reuse
					this.activeProviders.set(providerId, {
						provider: openaiProvider,
						lastUsed: Date.now(),
						id: providerId,
					});
					return openaiProvider;

				default:
					console.error(`Unknown provider: ${settings.provider}`);
					return null;
			}
		} catch (error) {
			console.error("Error creating provider:", error);
			return null;
		}
	}

	/**
	 * Clean up the oldest provider to make room for new ones
	 * @private
	 */
	private static cleanupOldestProvider(): void {
		if (this.activeProviders.size === 0) return;

		let oldestId: string | null = null;
		let oldestTime = Infinity;

		// Find the oldest provider
		for (const [id, providerData] of this.activeProviders.entries()) {
			if (providerData.lastUsed < oldestTime) {
				oldestTime = providerData.lastUsed;
				oldestId = id;
			}
		}

		// Remove the oldest provider
		if (oldestId) {
			this.activeProviders.delete(oldestId);
			console.log(
				`Released oldest provider ${oldestId} to make room for new provider`
			);
		}
	}

	/**
	 * Get an existing provider instance of the specified type if available
	 * @private
	 */
	private static getExistingProvider(
		providerType: LLMProvider
	): AIExcerptProvider | null {
		for (const [id, providerData] of this.activeProviders.entries()) {
			const provider = providerData.provider;
			if (
				(providerType === LLMProvider.CLAUDE &&
					provider instanceof ClaudeProvider) ||
				(providerType === LLMProvider.OPENAI &&
					provider instanceof OpenAIProvider)
			) {
				// Update last used timestamp
				providerData.lastUsed = Date.now();
				return provider;
			}
		}
		return null;
	}

	/**
	 * Creates a fallback provider when the primary provider fails
	 *
	 * This helps ensure continuity when a provider's API is experiencing issues.
	 * If the primary provider is Claude, it falls back to OpenAI, and vice versa.
	 *
	 * @param settings - The plugin settings
	 * @param primaryProvider - The type of the primary provider that failed
	 * @returns An object containing the fallback provider and status information
	 */
	static createFallbackProvider(
		settings: AIExcerptSettings,
		primaryProvider: LLMProvider
	): FallbackResult {
		// Default return object
		const result: FallbackResult = {
			provider: null,
			fallbackType: null,
			needsConfiguration: false,
			success: false,
		};

		// If primary is Claude, try OpenAI as fallback
		if (primaryProvider === LLMProvider.CLAUDE) {
			result.fallbackType = LLMProvider.OPENAI;

			// Check if OpenAI is in cooldown
			if (this.isProviderInCooldown(LLMProvider.OPENAI)) {
				console.log(
					`Fallback provider (OpenAI) is also in cooldown. No available providers.`
				);
				return result;
			}

			if (settings.openaiApiKey) {
				console.log(
					`Falling back to OpenAI provider due to Claude API issues`
				);
				const providerId = `${
					LLMProvider.OPENAI
				}-fallback-${Date.now()}`;
				const openaiProvider = new OpenAIProvider(
					settings.openaiApiKey,
					settings.openaiModel,
					settings.promptType
				);

				// Store the provider for reuse
				this.activeProviders.set(providerId, {
					provider: openaiProvider,
					lastUsed: Date.now(),
					id: providerId,
				});
				result.provider = openaiProvider;
				result.success = true;
			} else {
				console.log(
					`Cannot fall back to OpenAI: API key not configured`
				);
				result.needsConfiguration = true;
			}
		}

		// If primary is OpenAI, try Claude as fallback
		else if (primaryProvider === LLMProvider.OPENAI) {
			result.fallbackType = LLMProvider.CLAUDE;

			// Check if Claude is in cooldown
			if (this.isProviderInCooldown(LLMProvider.CLAUDE)) {
				console.log(
					`Fallback provider (Claude) is also in cooldown. No available providers.`
				);
				return result;
			}

			if (settings.claudeApiKey) {
				console.log(
					`Falling back to Claude provider due to OpenAI API issues`
				);
				const providerId = `${
					LLMProvider.CLAUDE
				}-fallback-${Date.now()}`;
				const claudeProvider = new ClaudeProvider(
					settings.claudeApiKey,
					settings.claudeModel,
					false, // useStreaming
					settings.promptType
				);

				// Store the provider for reuse
				this.activeProviders.set(providerId, {
					provider: claudeProvider,
					lastUsed: Date.now(),
					id: providerId,
				});
				result.provider = claudeProvider;
				result.success = true;
			} else {
				console.log(
					`Cannot fall back to Claude: API key not configured`
				);
				result.needsConfiguration = true;
			}
		}

		return result;
	}

	/**
	 * Reports a provider failure to implement cooldown mechanism
	 *
	 * @param provider - The provider type that failed
	 */
	static reportProviderFailure(provider: LLMProvider): void {
		// Put the provider in cooldown after failure
		this.setProviderCooldown(provider);
		this.failedProviders.add(provider);
	}

	/**
	 * Releases a provider instance when it's no longer needed
	 * This doesn't destroy the provider but marks it as available for reuse
	 *
	 * @param provider - The provider instance to release
	 */
	static releaseProvider(provider: AIExcerptProvider): void {
		// Find the provider in our active providers map
		for (const [id, providerData] of this.activeProviders.entries()) {
			if (providerData.provider === provider) {
				// Instead of removing, update last used time to show it's available
				providerData.lastUsed = Date.now();
				console.log(`Provider ${id} marked as available for reuse`);
				return;
			}
		}
	}

	/**
	 * Get a unique identifier for a provider based on settings
	 */
	private static getProviderId(settings: AIExcerptSettings): string {
		return `${settings.provider}-${
			settings.provider === LLMProvider.CLAUDE
				? settings.claudeModel
				: settings.openaiModel
		}`;
	}
}
