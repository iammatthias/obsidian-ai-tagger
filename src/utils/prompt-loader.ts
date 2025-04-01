import { App, PluginManifest } from "obsidian";
import * as path from "path";

/**
 * Prompt templates manager that loads prompts from markdown files in Obsidian
 */
export class PromptLoader {
	private static cache: Record<string, string> = {};
	private static app: App | null = null;
	private static pluginId = "ai-excerpt-generator";

	/**
	 * Initialize the prompt loader with Obsidian's App instance
	 *
	 * @param app - Obsidian App instance
	 */
	public static initialize(app: App): void {
		this.app = app;
	}

	/**
	 * Load a prompt template from a markdown file
	 * Loads prompts from the plugin's packaged prompts
	 *
	 * @param filename - The name of the markdown file (without extension)
	 * @returns The prompt content as a string
	 */
	public static async load(filename: string): Promise<string> {
		if (!this.app) {
			throw new Error(
				"PromptLoader not initialized. Call initialize() first."
			);
		}

		const cacheKey = filename;

		// Return from cache if available
		if (this.cache[cacheKey]) {
			return this.cache[cacheKey];
		}

		let content: string | null = null;

		try {
			// Get the plugin instance
			const plugins = (this.app as any).plugins;
			const plugin = plugins.getPlugin(this.pluginId);

			if (plugin) {
				const pluginPromptPath = `prompts/${filename}.md`;

				try {
					// Attempt multiple strategies to find the prompt file
					const possiblePaths = [];

					// Strategy 1: Using plugin.path if available
					if (plugin.path) {
						possiblePaths.push(
							path.join(plugin.path, pluginPromptPath)
						);
					}

					// Strategy 2: Using manifest.dir if available
					if (plugin.manifest && plugin.manifest.dir) {
						possiblePaths.push(
							path.join(plugin.manifest.dir, pluginPromptPath)
						);
					}

					// Strategy 3: Direct path in plugin directory
					possiblePaths.push(pluginPromptPath);

					// Strategy 4: Using baseDir from plugin settings if available
					if ((plugin as any).baseDir) {
						possiblePaths.push(
							path.join((plugin as any).baseDir, pluginPromptPath)
						);
					}

					// Try each path until we find one that works
					for (const pathToTry of possiblePaths) {
						if (await this.app.vault.adapter.exists(pathToTry)) {
							content = await this.app.vault.adapter.read(
								pathToTry
							);
							console.log(
								`Loaded prompt from path: ${pathToTry}`
							);
							break;
						}
					}

					// If still no content, look directly in plugin's bundled files
					if (!content && plugin.manifest) {
						// Try to find in the plugin's resources directory
						const resourcePath = `.obsidian/plugins/${this.pluginId}/${pluginPromptPath}`;
						if (await this.app.vault.adapter.exists(resourcePath)) {
							content = await this.app.vault.adapter.read(
								resourcePath
							);
							console.log(
								`Loaded prompt from plugin resources: ${resourcePath}`
							);
						}
					}

					if (!content) {
						console.warn(
							`Could not find prompt file: ${filename} in any location`
						);
					}
				} catch (pluginError) {
					console.error(
						`Error loading from plugin directory: ${pluginError}`
					);
				}
			} else {
				console.error(`Plugin not found: ${this.pluginId}`);
			}

			// If content was loaded, process and cache it
			if (content) {
				const promptContent = this.processMarkdown(content);
				this.cache[cacheKey] = promptContent;
				return promptContent;
			}

			// Provide a basic default prompt if the file can't be loaded
			if (filename === "excerpt-generation") {
				const defaultPrompt =
					"Generate a concise summary of the following text in less than 200 words, focusing on the key points and main ideas.";
				console.warn("Using hardcoded default prompt as fallback");
				this.cache[cacheKey] = defaultPrompt;
				return defaultPrompt;
			}

			// If we couldn't load the content, throw an error
			throw new Error(`Failed to load prompt template: ${filename}`);
		} catch (error) {
			console.error(`Failed to load prompt template: ${filename}`, error);
			throw error;
		}
	}

	/**
	 * Process markdown content to extract usable prompt text
	 * Handles Mixdown subset of Markdown format
	 *
	 * @param markdown - Raw markdown content
	 * @returns Processed prompt text
	 */
	private static processMarkdown(markdown: string): string {
		// Split by lines
		const lines = markdown.split("\n");

		// Remove title (first line starting with #)
		let startIndex = 0;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().startsWith("#")) {
				startIndex = i + 1;
				break;
			}
		}

		// Join the remaining lines with proper paragraph handling
		// This preserves the Mixdown subset of Markdown formatting
		return lines
			.slice(startIndex)
			.join("\n")
			.replace(/\n{3,}/g, "\n\n") // Normalize multiple blank lines to double blank lines
			.trim();
	}

	/**
	 * Clear the cache
	 */
	public static clearCache(): void {
		this.cache = {};
	}
}
