import "openai/shims/web";
import OpenAI from "openai";
import { APIError } from "openai";
import { AIExcerptProvider, PromptType } from "../types";
import { TagUtils } from "../utils/tag-utils";

/**
 * OpenAI provider implementation for generating tags
 */
export class OpenAIProvider implements AIExcerptProvider {
	private client: OpenAI;
	private model: string;
	private useChatAPI: boolean;
	private promptType: PromptType;
	private lastUsage: { input: number; output: number } | null = null;

	/**
	 * Creates a new OpenAI provider instance
	 */
	constructor(
		apiKey: string,
		model: string,
		promptType = PromptType.TAG_GENERATION,
		useChatAPI = true
	) {
		this.client = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
			timeout: 60 * 1000,
			maxRetries: 2,
		});
		this.model = model;
		this.promptType = promptType;
		this.useChatAPI = useChatAPI;
	}

	async generateTags(content: string): Promise<string[]> {
		try {
			// Get existing tags for context
			const existingTags = TagUtils.getAllVaultTags();
			const existingTagsContext =
				existingTags.length > 0
					? `\nExisting tags in the vault (use these for consistency when appropriate):\n${existingTags.join(
							", "
					  )}`
					: "";

			const response = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{
						role: "system",
						content:
							"You are an expert at analyzing content and generating relevant, consistent tags that follow Obsidian's best practices. You understand the importance of maintaining a clean and useful tag hierarchy. When possible, reuse existing tags to maintain consistency across the knowledge base.",
					},
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
				temperature: 0.3,
				max_tokens: 300,
			});

			if (!response || response.choices.length === 0) {
				throw new Error("Empty response from OpenAI API");
			}

			const responseText =
				response.choices[0]?.message?.content?.trim() || "";

			// Parse the response as JSON array
			try {
				const tags = JSON.parse(responseText);
				if (!Array.isArray(tags)) {
					throw new Error("Response is not an array");
				}
				return tags;
			} catch (error) {
				console.error(
					"Failed to parse OpenAI response as JSON array:",
					error
				);
				// Fallback: try to extract tags from non-JSON response
				return responseText
					.split(/[,\n]/)
					.map((tag: string) => tag.trim())
					.filter((tag: string) => tag.length > 0);
			}
		} catch (error) {
			console.error("Error calling OpenAI API:", error);
			throw error;
		}
	}
}
