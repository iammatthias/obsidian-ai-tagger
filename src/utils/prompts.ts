import { App } from "obsidian";
import { PromptType } from "../types";

/**
 * Utility class for managing prompt templates
 */
export class Prompts {
	private static app: App;
	private static promptCache: Record<string, string> = {};

	/**
	 * Initialize the prompts system
	 */
	public static initialize(app: App): void {
		this.app = app;
	}

	/**
	 * Load all prompt templates into memory
	 */
	public static async loadAllPrompts(): Promise<void> {
		await this.loadPrompt(PromptType.TAG_GENERATION);
	}

	/**
	 * Reload all prompts (used when settings change)
	 */
	public static async reload(): Promise<void> {
		this.promptCache = {};
		await this.loadAllPrompts();
	}

	/**
	 * Load a specific prompt template
	 */
	private static async loadPrompt(type: PromptType): Promise<void> {
		try {
			const response = await fetch(`/prompts/${type}.md`);
			const text = await response.text();
			this.promptCache[type] = text;
		} catch (error) {
			console.error(`Failed to load prompt template: ${type}`, error);
			this.promptCache[type] = this.defaultPrompt;
		}
	}

	/**
	 * Get the tag generation prompt
	 */
	public static get tagGeneration(): string {
		return (
			this.promptCache[PromptType.TAG_GENERATION] || this.defaultPrompt
		);
	}

	/**
	 * Default prompt for tag generation
	 */
	private static get defaultPrompt(): string {
		return `<prompt>
  <meta>
    title: Tag Generation Prompt
    description: Generates relevant tags for Obsidian notes
    author: Matthias Jordan
    created: March 25, 2025
    version: 1.0.0
    tags:
      - tags
      - metadata
      - obsidian
  </meta>
  <params>
    system: You are an expert at analyzing content and generating relevant, consistent tags that follow Obsidian's best practices. You understand the importance of maintaining a clean and useful tag hierarchy.
    instructions:
      - Generate a list of relevant tags for the given content
      - Follow Obsidian's tag best practices:
        - Use lowercase letters
        - Use hyphens for multi-word tags
        - Keep tags concise and meaningful
        - Avoid special characters (except hyphens)
        - Create hierarchical tags when appropriate (e.g., tech/programming)
      - Focus on key topics, themes, and concepts
      - Include both broad categories and specific details when relevant
      - Maintain consistency with existing tag patterns
      - Avoid overly generic tags that wouldn't be useful for filtering
      - Limit to 3-7 most relevant tags unless content is highly complex
      - Do not include the prefix in the tags - it will be added later if configured
    content:
      text: {{ original_text }}
    output:
      format: json
      structure: array
  </params>
  <system />
  <instructions />
  <o>
    {{ tags }}
  </o>
</prompt>`;
	}
}
