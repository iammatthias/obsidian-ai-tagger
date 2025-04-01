# Obsidian AI Tag Generator

Generate relevant, consistent tags for your Obsidian notes using AI. This plugin adds or updates the `tags` field in your markdown files' frontmatter, making it easier to organize and find your notes.

## Features

-   Generate tags for individual notes or process your entire vault
-   Choose between Claude (Anthropic) or OpenAI as your AI provider
-   Follows Obsidian's tag best practices
-   Optional tag prefix (e.g., '#')
-   Automatic frontmatter creation if needed
-   Hierarchical tag support (e.g., tech/programming)
-   Batch processing capabilities
-   Preserves existing tags when requested
-   Configurable AI parameters for fine-tuned results

## Installation

1. Download the latest release from the [Releases page](https://github.com/iammatthias/obsidian-ai-tagger/releases)
2. Extract the ZIP into your vault's `.obsidian/plugins` folder
3. Enable the plugin in Obsidian's Community Plugins settings
4. Configure your preferred AI provider in the plugin settings

## Using the Plugin

### Initial Setup

1. Open Settings > Community Plugins > AI Tag Generator
2. Choose your preferred AI provider (Claude or OpenAI)
3. Add your API key
4. Configure tag settings (prefix, preservation options, etc.)

### Generating Tags

You can generate tags in several ways:

-   **Command Palette**: Press `Cmd/Ctrl + P` and search for "AI Tag Generator"
-   **Context Menu**: Right-click on a file or folder in the file explorer
-   **AI Tag Commands Modal**: Use the dedicated modal for all tagging options
-   **Hotkeys**: Set up custom hotkeys in Obsidian's settings

### Processing Options

-   Single file
-   Current directory
-   Specific directory
-   Entire vault
-   Multiple selected files

## Configuration Options

### AI Provider Settings

Choose your preferred AI provider and model:

**Claude (Anthropic)**

-   Claude 3.7 Sonnet (`claude-3-7-sonnet-20250219`) - Recommended
-   Claude 3.5 models (Sonnet and Haiku variants)
-   Claude 3 models (Opus, Sonnet, and Haiku)

**OpenAI**

-   O-series models (`o3-mini`, `o1`, etc.)
-   GPT models (`gpt-4.5-preview`, `gpt-4`, `gpt-3.5-turbo`)

### Tag Settings

-   **Tag Prefix**: Optional prefix (e.g., '#') - Leave empty for no prefix
-   **Tag Preservation**: Choose to keep or replace existing tags
-   **Tag Format**:
    -   Lowercase letters
    -   Hyphens for multi-word tags
    -   Concise and meaningful
    -   No special characters (except hyphens)
    -   Hierarchical tags supported (e.g., tech/programming)

### Advanced Options

-   **Batch Size**: Control how many files are processed simultaneously
-   **Rate Limiting**: Adjust processing speed to manage API usage
-   **Custom Prompts**: Fine-tune the AI's tagging behavior
-   **Error Handling**: Configure retry attempts and error notifications

## Development

1. Clone this repo
2. Install dependencies:
    ```bash
    npm install
    # or
    yarn
    ```
3. Start development:
    ```bash
    npm run dev
    ```

### Building

```bash
npm run build
```

### Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

## Support

-   [GitHub Issues](https://github.com/iammatthias/obsidian-ai-tagger/issues) for bug reports and feature requests
-   [GitHub Discussions](https://github.com/iammatthias/obsidian-ai-tagger/discussions) for general questions and discussions

## License

MIT © [Matthias Jordan](https://iammatthias.com)
