import {
	App,
	FileManager,
	Notice,
	TFile,
	TFolder,
	Vault,
	normalizePath,
} from "obsidian";
import { AIExcerptPlugin, AIExcerptSettings, LLMProvider } from "../types";
import { ProviderFactory } from "../providers/provider-factory";
import { FileUtils } from "../utils/file-utils";
import { TagUtils } from "../utils/tag-utils";

/**
 * Handles processing of files and directories to add or update excerpts
 * using AI-generated content.
 *
 * This service encapsulates all the logic for:
 * - Reading file content
 * - Detecting and manipulating frontmatter
 * - Requesting AI-generated excerpts from providers
 * - Updating files with new content
 * - Processing files in batch operations
 */
export class FileProcessor {
	private vault: Vault;
	private fileManager: FileManager;
	private settings: AIExcerptSettings;
	private plugin: AIExcerptPlugin | null = null;

	/**
	 * Creates a new FileProcessor instance
	 *
	 * @param vault - The Obsidian vault instance
	 * @param fileManager - The Obsidian file manager instance
	 * @param settings - Plugin settings containing API keys and preferences
	 * @param plugin - Reference to the main plugin instance (optional)
	 */
	constructor(
		vault: Vault,
		fileManager: FileManager,
		settings: AIExcerptSettings,
		plugin?: AIExcerptPlugin
	) {
		this.vault = vault;
		this.fileManager = fileManager;
		this.settings = settings;
		this.plugin = plugin || null;
	}

	private async enhanceTagConsistency(
		generatedTags: string[]
	): Promise<string[]> {
		const existingTags = TagUtils.getAllVaultTags();
		const enhancedTags = new Set<string>();

		for (const tag of generatedTags) {
			// Check if the exact tag already exists
			if (existingTags.includes(tag)) {
				enhancedTags.add(tag);
				continue;
			}

			// Find similar tags
			const similarTags = TagUtils.findSimilarTags(tag);
			if (similarTags.length > 0) {
				// Use the most similar existing tag
				enhancedTags.add(similarTags[0]);
			} else {
				// If no similar tags found, use the new tag
				enhancedTags.add(tag);
			}
		}

		return Array.from(enhancedTags);
	}

	/**
	 * Process a single file to add or update its excerpt in the frontmatter
	 *
	 * This function will:
	 * 1. Check if the file is a markdown file
	 * 2. Check if the file has frontmatter
	 * 3. Check if the frontmatter has an excerpt field
	 * 4. Generate an excerpt using the configured AI provider if needed
	 * 5. Update the file with the new excerpt
	 *
	 * @param file - The file to process
	 * @param showNotices - Whether to show notification messages for this file
	 * @throws Error if the file processing fails
	 */
	async processFile(file: TFile, showNotices: boolean = true): Promise<void> {
		// Validate file type
		if (file.extension !== "md") {
			if (showNotices) {
				new Notice("Only markdown files are supported");
			}
			return;
		}

		// Get provider
		const provider = ProviderFactory.createProvider(this.settings);
		if (!provider) {
			if (showNotices) {
				new Notice("Failed to initialize AI provider");
			}
			return;
		}

		try {
			// Read file contents
			const content = await this.vault.read(file);

			// Check if the file has frontmatter
			const { hasFrontmatter, frontmatter } =
				FileUtils.extractFrontmatter(content);

			if (!hasFrontmatter) {
				// No frontmatter, add one with tags
				const contentWithoutFrontmatter = content;
				try {
					const tags = await provider.generateTags(
						contentWithoutFrontmatter
					);
					const enhancedTags = await this.enhanceTagConsistency(tags);
					const formattedTags = this.formatTags(enhancedTags);

					// For files without frontmatter, we need to add it
					await this.vault.process(file, (data) => {
						return FileUtils.createContentWithTags(
							content,
							formattedTags
						);
					});

					if (showNotices)
						new Notice(
							`Added frontmatter with generated tags to ${file.name}`
						);

					// Release the provider after successful use
					ProviderFactory.releaseProvider(provider);
					return;
				} catch (error) {
					console.error("Error generating tags:", error);
					if (showNotices) {
						new Notice("Failed to generate tags");
					}
					// Release the provider after failure
					ProviderFactory.releaseProvider(provider);
					return;
				}
			}

			// Extract content without frontmatter for processing
			const contentWithoutFrontmatter = content.replace(
				FileUtils.FRONTMATTER_REGEX,
				""
			);

			// Check if tags already exist
			const hasTags = frontmatter && frontmatter.includes("tags:");

			// We'll generate new tags regardless of whether they already exist
			try {
				const tags = await provider.generateTags(
					contentWithoutFrontmatter
				);
				const enhancedTags = await this.enhanceTagConsistency(tags);
				const formattedTags = this.formatTags(enhancedTags);

				// Use fileManager.processFrontMatter to safely update the frontmatter
				await this.fileManager.processFrontMatter(
					file,
					(frontmatter) => {
						frontmatter["tags"] = formattedTags;
					}
				);

				if (showNotices) {
					if (hasTags) {
						new Notice(
							`Updated tags in frontmatter for ${file.name}`
						);
					} else {
						new Notice(
							`Added tags field to frontmatter in ${file.name}`
						);
					}
				}

				// Release the provider after successful use
				ProviderFactory.releaseProvider(provider);
			} catch (providerError) {
				// Report provider failure
				ProviderFactory.reportProviderFailure(this.settings.provider);

				// Try fallback provider if primary fails
				const fallbackResult = ProviderFactory.createFallbackProvider(
					this.settings,
					this.settings.provider
				);

				if (fallbackResult.success && fallbackResult.provider) {
					try {
						const tags = await fallbackResult.provider.generateTags(
							contentWithoutFrontmatter
						);
						const enhancedTags = await this.enhanceTagConsistency(
							tags
						);
						const formattedTags = this.formatTags(enhancedTags);

						await this.fileManager.processFrontMatter(
							file,
							(frontmatter) => {
								frontmatter["tags"] = formattedTags;
							}
						);

						if (showNotices) {
							new Notice(
								`Generated tags using fallback provider for ${file.name}`
							);
						}

						// Release the fallback provider
						ProviderFactory.releaseProvider(
							fallbackResult.provider
						);
					} catch (fallbackError) {
						console.error(
							"Fallback provider failed:",
							fallbackError
						);
						if (showNotices) {
							new Notice(
								"Failed to generate tags with fallback provider"
							);
						}
						// Release the fallback provider after failure
						if (fallbackResult.provider) {
							ProviderFactory.releaseProvider(
								fallbackResult.provider
							);
						}
					}
				} else {
					if (showNotices) {
						new Notice(
							"Failed to generate tags - no fallback available"
						);
					}
				}
			}
		} catch (error) {
			console.error("Error processing file:", error);
			if (showNotices) {
				new Notice("Failed to process file");
			}
			// Release the provider after failure
			ProviderFactory.releaseProvider(provider);
		}
	}

	private formatTags(tags: string[]): string[] {
		return tags.map((tag) => {
			// Add prefix if configured
			const prefix = this.settings.tagPrefix || "";
			// Ensure tag follows Obsidian conventions
			const formattedTag = tag
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9/\-]/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");
			return prefix + formattedTag;
		});
	}

	/**
	 * Process all markdown files in a directory and its subdirectories
	 *
	 * @param folder - The root folder to process
	 * @throws Error if the directory processing fails
	 */
	async processDirectory(folder: TFolder): Promise<void> {
		// Create a function to recursively collect all markdown files
		const collectMarkdownFiles = (folder: TFolder): TFile[] => {
			let markdownFiles: TFile[] = [];

			// First, collect markdown files in the current folder
			folder.children.forEach((child) => {
				if (child instanceof TFile && child.extension === "md") {
					markdownFiles.push(child);
				} else if (child instanceof TFolder) {
					// Recursively collect files from subfolders
					markdownFiles = markdownFiles.concat(
						collectMarkdownFiles(child)
					);
				}
			});

			return markdownFiles;
		};

		// Collect all markdown files from the folder and its subfolders
		const files = collectMarkdownFiles(folder);

		if (files.length === 0) {
			new Notice(
				`No markdown files found in ${folder.path} or its subfolders`
			);
			if (this.plugin) {
				this.plugin.updateStatusBar(0, 0);
			}
			return;
		}

		new Notice(
			`Processing ${files.length} files in ${folder.path} and its subfolders...`
		);

		// Initialize status bar with total files to process
		if (this.plugin) {
			this.plugin.updateStatusBar(0, files.length);
		}

		let processed = 0;
		let errors = 0;
		const batchSize = 5; // Process 5 files at a time

		// Process files in batches to avoid overwhelming the API
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			// Process each file in the current batch
			for (const file of batch) {
				try {
					await this.processFile(file, false); // Don't show individual notices
					processed++;

					// Update status bar with progress
					if (this.plugin) {
						this.plugin.updateStatusBar(processed, files.length);
					}

					// Show progress updates
					if (processed % 5 === 0 || processed === files.length) {
						new Notice(
							`Processed ${processed}/${files.length} files in ${folder.path} and subfolders`
						);
					}
				} catch (error) {
					console.error(`Error processing ${file.path}:`, error);
					errors++;
				}
			}

			// Add a delay between batches to prevent rate limiting
			if (i + batchSize < files.length) {
				await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay between batches
			}
		}

		// Show final completion notice with success and error counts
		new Notice(
			`Completed. Processed ${processed}/${files.length} files in ${folder.path} and subfolders.` +
				(errors > 0 ? ` Errors: ${errors}` : "")
		);

		// Reset status bar after completion
		setTimeout(() => {
			if (this.plugin) {
				this.plugin.updateStatusBar(0, 0);
			}
		}, 5000); // Reset after 5 seconds
	}

	/**
	 * Process all markdown files in the vault
	 *
	 * @throws Error if the vault processing fails
	 */
	async processAllFiles(): Promise<void> {
		const files = this.vault.getMarkdownFiles();
		let processed = 0;
		let errors = 0;
		const batchSize = 5; // Process 5 files at a time

		new Notice(`Processing ${files.length} files...`);

		// Initialize status bar with total files to process
		if (this.plugin) {
			this.plugin.updateStatusBar(0, files.length);
		}

		// Process files in batches to avoid overwhelming the API
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			// Process each file in the current batch
			for (const file of batch) {
				try {
					await this.processFile(file, false); // Don't show individual notices
					processed++;

					// Update status bar with progress
					if (this.plugin) {
						this.plugin.updateStatusBar(processed, files.length);
					}

					// Show progress updates
					if (processed % 5 === 0 || processed === files.length) {
						new Notice(
							`Processed ${processed}/${files.length} files`
						);
					}
				} catch (error) {
					console.error(`Error processing ${file.path}:`, error);
					errors++;
				}
			}

			// Add a delay between batches to prevent rate limiting
			if (i + batchSize < files.length) {
				await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay between batches
			}
		}

		// Show final completion notice with success and error counts
		new Notice(
			`Completed. Processed ${processed}/${files.length} files.` +
				(errors > 0 ? ` Errors: ${errors}` : "")
		);

		// Reset status bar after completion
		setTimeout(() => {
			if (this.plugin) {
				this.plugin.updateStatusBar(0, 0);
			}
		}, 5000); // Reset after 5 seconds
	}
}
