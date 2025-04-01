import "@anthropic-ai/sdk/shims/web";
import { Anthropic } from "@anthropic-ai/sdk";
import { APIError } from "@anthropic-ai/sdk";
import { AIExcerptProvider, PromptType } from "../types";
import { TagUtils } from "../utils/tag-utils";

/**
 * Claude AI provider implementation for generating tags
 */
export class ClaudeProvider implements AIExcerptProvider {
	private client: Anthropic;
	private model: string;
	private useStreaming: boolean;
	private promptType: PromptType;
	private lastUsage: { input: number; output: number } | null = null;
	private retryCount: number = 0;
	private maxRetries: number = 5;
	private lastRequestTime: number = 0;
	private minRequestInterval: number = 500; // 500ms minimum between requests

	/**
	 * Creates a new Claude provider instance
	 */
	constructor(
		apiKey: string,
		model: string,
		useStreaming = false,
		promptType = PromptType.TAG_GENERATION
	) {
		this.client = new Anthropic({
			apiKey,
			dangerouslyAllowBrowser: true,
		});
		this.model = model;
		this.useStreaming = useStreaming;
		this.promptType = promptType;
	}

	/**
	 * Ensures rate limiting by waiting if requests are too frequent
	 * @private
	 */
	private async _enforceRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.minRequestInterval) {
			const waitTime = this.minRequestInterval - timeSinceLastRequest;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Get token usage information for the last request if available
	 */
	getTokenUsage(): { input: number; output: number } | null {
		return this.lastUsage;
	}

	async generateTags(content: string): Promise<string[]> {
		try {
			await this._enforceRateLimit();

			// Get existing tags for context
			const existingTags = TagUtils.getAllVaultTags();
			const existingTagsContext =
				existingTags.length > 0
					? `\nExisting tags in the vault (use these for consistency when appropriate):\n${existingTags.join(
							", "
					  )}`
					: "";

			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 300,
				temperature: 0.3,
				system: "You are an expert at analyzing content and generating relevant, consistent tags that follow Obsidian's best practices. You understand the importance of maintaining a clean and useful tag hierarchy. When possible, reuse existing tags to maintain consistency across the knowledge base.",
				messages: [
					{
						role: "user",
						content: `Generate relevant tags for the following content. Follow these rules:
						- Use lowercase letters
						- Use hyphens for multi-word tags
						- Keep tags concise and meaningful
						- Avoid special characters (except hyphens)
						- Create hierarchical tags when appropriate (e.g., tech/programming)
						- Focus on key topics, themes, and concepts
						- Include both broad categories and specific details when relevant
						- Maintain consistency with existing tag patterns
						- Prioritize reusing existing tags when they fit the content
						- Only create new tags when existing ones don't capture the concept
						- Avoid overly generic tags that wouldn't be useful for filtering
						- Limit to 3-7 most relevant tags unless content is highly complex
						- Return ONLY the tags as a JSON array of strings${existingTagsContext}
						
						Content:
						${content}`,
					},
				],
			});

			if (!response || !response.content) {
				throw new Error("Empty response from Claude API");
			}

			const responseText =
				response.content[0].type === "text"
					? response.content[0].text
					: "";

			// Parse the response as JSON array
			try {
				const tags = JSON.parse(responseText);
				if (!Array.isArray(tags)) {
					throw new Error("Response is not an array");
				}
				return tags;
			} catch (error) {
				console.error(
					"Failed to parse Claude response as JSON array:",
					error
				);
				// Fallback: try to extract tags from non-JSON response
				return responseText
					.split(/[,\n]/)
					.map((tag: string) => tag.trim())
					.filter((tag: string) => tag.length > 0);
			}
		} catch (error) {
			console.error("Error calling Claude API:", error);
			throw error;
		}
	}
}
