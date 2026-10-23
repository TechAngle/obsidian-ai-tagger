# AI Notes Tagger for Obsidian

An Obsidian plugin that automatically tags notes with inline hashtags at the beginning of the file using local or remote LLMs (Ollama, LM Studio, vLLM, OpenAI, or any OpenAI-compatible server).

## Features

- **Inline Hashtags at Beginning of Note**: Inserts or appends tags as `#hashtag` format on the first line of the note (or immediately after YAML frontmatter if present).
- **Token Minimization & Preprocessing**: Optimizes prompt tokens by stripping existing frontmatter, existing hashtag headers, code blocks, images, HTML comments, URLs, and formatting noise before sending text to the LLM.
- **Empty Note Detection**: Automatically skips notes without analyzable text and notifies you with `"No text for analysis"`.
- **Structured JSON Schema**: Enforces strict JSON schema responses (`{ "tags": string[] }`) to guarantee reliable parsing.
- **Deduplicated Appending**: If a hashtag line already exists at the top of the file, newly generated hashtags are merged and appended without duplicates.
- **Rich Context**: Includes note creation date, last modification date, file name, and minimized content in the analysis context.
- **OpenAI-Compatible & Local First**: Out-of-the-box support for local Ollama (`http://localhost:11434/v1`) or any OpenAI-compatible API endpoint.
- **Native Obsidian Networking**: Built strictly using Obsidian's `requestUrl` API (no `fetch`), ensuring security and cross-platform compatibility.

## Installation

1. Copy `main.js`, `manifest.json`, and `styles.css` into your Obsidian vault under:
   ```
   <Vault>/.obsidian/plugins/ai-tagger/
   ```
2. In Obsidian, navigate to **Settings → Community plugins**.
3. Reload community plugins and enable **AI Notes Tagger**.

## Configuration

In **Settings → AI Notes Tagger**, configure:

- **Host of server**: The base URL of your API endpoint (e.g. `http://localhost:11434/v1` or `https://api.openai.com/v1`).
- **Auth key**: Optional API key or bearer token (leave blank for local Ollama).
- **Model name**: Model identifier (e.g. `llama3.2`, `mistral`, `gpt-4o-mini`).
- **Minimum amount of tags**: Lower bound for generated tags (must be $\ge 1$ and $\le \text{maximum}$).
- **Maximum amount of tags**: Upper bound for generated tags (must be $\ge 1$ and $\ge \text{minimum}$).
- **Connection test**: Click **Test connection** to verify connectivity, authentication, and model availability.

> **Validation**: Negative numbers and cases where minimum exceeds maximum are blocked with immediate visual feedback in the settings tab.

## Usage

You can trigger note tagging in three ways:

1. **Command Palette**: Press `Ctrl+P` (or `Cmd+P`), search for **AI Notes Tagger: Tag current note with AI**, and press Enter.
2. **Ribbon Icon**: Click the tag icon in the left ribbon to tag the currently active note.
3. **File Explorer Context Menu**: Right-click any Markdown note in the file explorer and select **Tag with AI**.

## Development

```bash
# Install dependencies
npm install

# Run build
npm run build

# Run linter
npm run lint
```
