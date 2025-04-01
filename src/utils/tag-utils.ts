import { App, TFile, getAllTags } from "obsidian";

/**
 * Utility class for managing and analyzing tags across the vault
 */
export class TagUtils {
	private static app: App;

	/**
	 * Initialize the tag utilities with Obsidian's App instance
	 */
	public static initialize(app: App): void {
		this.app = app;
	}

	/**
	 * Get all unique tags used in the vault
	 * @returns Array of unique tags without prefix
	 */
	public static getAllVaultTags(): string[] {
		const files = this.app.vault.getMarkdownFiles();
		const allTags = new Set<string>();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.tags) {
				cache.tags.forEach((tag) => {
					// Remove the '#' prefix if it exists
					const cleanTag = tag.tag.replace(/^#/, "");
					allTags.add(cleanTag);
				});
			}

			// Also check frontmatter tags
			if (cache?.frontmatter?.tags) {
				const fmTags = Array.isArray(cache.frontmatter.tags)
					? cache.frontmatter.tags
					: [cache.frontmatter.tags];

				fmTags.forEach((tag) => {
					const cleanTag = String(tag).replace(/^#/, "");
					allTags.add(cleanTag);
				});
			}
		}

		return Array.from(allTags);
	}

	/**
	 * Find similar existing tags based on a given tag
	 * Uses Levenshtein distance to find similar tags
	 * @param tag - The tag to find similar matches for
	 * @param threshold - Maximum Levenshtein distance (default: 2)
	 * @returns Array of similar existing tags
	 */
	public static findSimilarTags(
		tag: string,
		threshold: number = 2
	): string[] {
		const existingTags = this.getAllVaultTags();
		const similarTags = existingTags.filter((existingTag) => {
			const distance = this.levenshteinDistance(tag, existingTag);
			return distance <= threshold && distance > 0;
		});

		return similarTags;
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 * @param a - First string
	 * @param b - Second string
	 * @returns The Levenshtein distance
	 */
	private static levenshteinDistance(a: string, b: string): number {
		if (a.length === 0) return b.length;
		if (b.length === 0) return a.length;

		const matrix = Array(b.length + 1)
			.fill(null)
			.map(() => Array(a.length + 1).fill(null));

		for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
		for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

		for (let j = 1; j <= b.length; j++) {
			for (let i = 1; i <= a.length; i++) {
				const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1,
					matrix[j - 1][i] + 1,
					matrix[j - 1][i - 1] + substitutionCost
				);
			}
		}

		return matrix[b.length][a.length];
	}
}
