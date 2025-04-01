import { TFile, Vault } from "obsidian";

/**
 * Utility class for file and frontmatter operations
 *
 * This class provides static methods for working with markdown files
 * and their frontmatter, particularly focused on tag management.
 */
export class FileUtils {
	/**
	 * Regular expression for matching YAML frontmatter in markdown files
	 * Matches the entire frontmatter block including the --- delimiters
	 */
	static readonly FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

	/**
	 * Regular expression for matching the tags field in frontmatter
	 */
	static readonly TAGS_REGEX =
		/^tags:\s*\[(.*)\]|^tags:\s*$|^tags:\n(\s+-.*)*$/m;

	/**
	 * Regular expression for matching the excerpt field in frontmatter
	 */
	private static readonly EXCERPT_REGEX = /^excerpt:\s*(.*)$/m;

	/**
	 * Extracts frontmatter from markdown content if present
	 *
	 * @param content - The markdown file content
	 * @returns Object containing frontmatter information
	 */
	static extractFrontmatter(content: string): {
		hasFrontmatter: boolean;
		frontmatter?: string;
		match?: RegExpMatchArray;
	} {
		if (!content || typeof content !== "string") {
			return { hasFrontmatter: false };
		}

		const frontmatterMatch = content.match(this.FRONTMATTER_REGEX);

		if (!frontmatterMatch) {
			return { hasFrontmatter: false };
		}

		return {
			hasFrontmatter: true,
			frontmatter: frontmatterMatch[1],
			match: frontmatterMatch,
		};
	}

	/**
	 * Checks if frontmatter has an excerpt field and extracts its value
	 *
	 * @param frontmatter - The frontmatter content (without --- delimiters)
	 * @returns Object containing excerpt information
	 */
	static extractExcerptFromFrontmatter(frontmatter: string): {
		hasExcerpt: boolean;
		excerpt?: string;
		match?: RegExpMatchArray;
	} {
		if (!frontmatter || typeof frontmatter !== "string") {
			return { hasExcerpt: false };
		}

		const excerptMatch = frontmatter.match(this.EXCERPT_REGEX);

		if (!excerptMatch) {
			return { hasExcerpt: false };
		}

		return {
			hasExcerpt: true,
			excerpt: excerptMatch[1].trim(),
			match: excerptMatch,
		};
	}

	/**
	 * Creates content with new frontmatter that includes tags
	 *
	 * @param content - The original content (will have frontmatter added)
	 * @param tags - Array of tags to add
	 * @returns Content with frontmatter including tags
	 */
	static createContentWithTags(content: string, tags: string[]): string {
		if (!content) return "";
		if (!tags || tags.length === 0) return content;

		const tagsYaml =
			tags.length === 1
				? `tags: [${tags[0]}]`
				: `tags:\n${tags.map((tag) => `  - ${tag}`).join("\n")}`;

		return `---\n${tagsYaml}\n---\n\n${content}`;
	}

	/**
	 * Removes frontmatter from content
	 *
	 * @param content - The content to remove frontmatter from
	 * @returns Content without frontmatter
	 */
	static removeFrontmatter(content: string): string {
		return content.replace(this.FRONTMATTER_REGEX, "").trim();
	}

	/**
	 * Escapes special characters in excerpt text to make it safe for YAML
	 *
	 * @param excerpt - The raw excerpt text
	 * @returns YAML-safe excerpt text
	 */
	static escapeExcerpt(excerpt: string): string {
		if (!excerpt) return "";

		// Trim and sanitize excerpt first
		let sanitized = excerpt.trim();

		// Check for special characters that would require quoting in YAML
		const needsQuotes =
			/[:#\[\]{}&*!|>'"%@`]/g.test(sanitized) ||
			sanitized.includes("\n") ||
			sanitized.startsWith(" ") ||
			sanitized.endsWith(" ") ||
			sanitized === "true" ||
			sanitized === "false" ||
			sanitized === "yes" ||
			sanitized === "no" ||
			sanitized === "null" ||
			/^[-+]?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$/.test(sanitized);

		// Replace all problematic characters
		sanitized = sanitized
			.replace(/\\/g, "\\\\") // Escape backslashes first!
			.replace(/"/g, '\\"') // Escape double quotes
			.replace(/\n/g, " ") // Replace newlines with spaces
			.replace(/\r/g, " ") // Replace carriage returns with spaces
			.replace(/\t/g, " ") // Replace tabs with spaces
			.replace(/\f/g, " ") // Replace form feeds
			.replace(/:/g, "\\:") // Escape colons (problematic in YAML)
			.replace(/\u0000/g, "") // Remove null bytes
			.replace(/[\u007F-\u009F]/g, "") // Remove control characters
			.replace(/[\u2028\u2029]/g, " "); // Replace line/paragraph separators with spaces

		// Prepare the final YAML safe excerpt
		// Always use double quotes for consistency and safer escaping
		return `"${sanitized}"`;
	}

	/**
	 * Creates content with new frontmatter that includes the excerpt
	 *
	 * @param content - The original content (will have frontmatter added)
	 * @param excerpt - The excerpt to add
	 * @returns Content with frontmatter including excerpt
	 */
	static createContentWithExcerpt(content: string, excerpt: string): string {
		if (!content) return "";
		if (!excerpt) return content;

		const escapedExcerpt = this.escapeExcerpt(excerpt);
		return `---\nexcerpt: ${escapedExcerpt}\n---\n\n${content}`;
	}

	/**
	 * Updates existing frontmatter to include or update excerpt
	 *
	 * @param content - The full file content including frontmatter
	 * @param frontmatter - The extracted frontmatter portion (without delimiters)
	 * @param excerpt - The excerpt to add or update
	 * @returns Updated content with modified frontmatter
	 */
	static updateFrontmatterWithExcerpt(
		content: string,
		frontmatter: string,
		excerpt: string
	): string {
		if (!content || !frontmatter) return content || "";
		if (!excerpt) return content;

		const escapedExcerpt = this.escapeExcerpt(excerpt);
		const excerptMatch = frontmatter.match(this.EXCERPT_REGEX);

		let newFrontmatter: string;
		if (excerptMatch) {
			// Replace existing excerpt
			newFrontmatter = frontmatter.replace(
				this.EXCERPT_REGEX,
				`excerpt: ${escapedExcerpt}`
			);
		} else {
			// Add excerpt to existing frontmatter
			newFrontmatter = frontmatter + `\nexcerpt: ${escapedExcerpt}`;
		}

		// Replace old frontmatter with new one
		return content.replace(
			this.FRONTMATTER_REGEX,
			`---\n${newFrontmatter}\n---`
		);
	}
}
