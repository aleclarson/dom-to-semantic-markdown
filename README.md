# @alloc/dom-to-semantic-markdown

This library converts HTML DOM to a semantic Markdown format optimized for use with Large Language Models (LLMs). It preserves the semantic structure of web content, extracts essential metadata, and reduces token usage compared to raw HTML, making it easier for LLMs to understand and process information.

**Note:** This is a personal fork of [romansky/dom-to-semantic-markdown](https://github.com/romansky/dom-to-semantic-markdown). Support will not be provided.

## Key Features

- **Semantic Structure Preservation:** Retains the meaning of HTML elements like `<header>`, `<footer>`, `<nav>`, and more.
- **Metadata Extraction:** Captures important metadata such as title, description, keywords, Open Graph tags, Twitter Card tags, and JSON-LD data.
- **Token Efficiency:** Optimizes for token usage through URL refification and concise representation of content.
- **Main Content Detection:** Automatically identifies and extracts the primary content section of a webpage.
- **Table Column Tracking:** Adds unique identifiers to table columns, improving LLM's ability to correlate data across rows.

## Installation

```bash
pnpm add @alloc/dom-to-semantic-markdown
```

## Usage

```javascript
import { convertHtmlToMarkdown } from "@alloc/dom-to-semantic-markdown";

const markdown = convertHtmlToMarkdown(document.body);
console.log(markdown);
```

## API

### `convertHtmlToMarkdown(html: string, options?: ConversionOptions): string`

Converts an HTML string to semantic Markdown. In the browser, the `html` argument is ignored, and the current document is used.

### `convertElementToMarkdown(element: Element, options?: ConversionOptions): string`

Converts an HTML Element to semantic Markdown.

### `ConversionOptions`

- `websiteDomain?: string`: The domain of the website being converted.
- `extractMainContent?: boolean`: Whether to extract only the main content of the page.
- `refifyUrls?: boolean`: Whether to convert URLs to reference-style links.
- `debug?: boolean`: Enable debug logging.
- `overrideDOMParser?: DOMParser`: Custom DOMParser for Node.js environments.
- `enableTableColumnTracking?: boolean`: Adds unique identifiers to table columns.
- `overrideElementProcessing?: (element: Element, options: ConversionOptions, indentLevel: number) => SemanticMarkdownAST[] | undefined`: Custom processing for HTML elements.
- `processUnhandledElement?: (element: Element, options: ConversionOptions, indentLevel: number) => SemanticMarkdownAST[] | undefined`: Handler for unknown HTML elements.
- `overrideNodeRenderer?: (node: SemanticMarkdownAST, options: ConversionOptions, indentLevel: number) => string | undefined`: Custom renderer for AST nodes.
- `renderCustomNode?: (node: CustomNode, options: ConversionOptions, indentLevel: number) => string | undefined`: Renderer for custom AST nodes.
- `includeMetaData?: 'basic' | 'extended'`: Controls whether to include metadata extracted from the HTML head.

  - `'basic'`: Includes standard meta tags like title, description, and keywords.
  - `'extended'`: Includes basic meta tags, Open Graph tags, Twitter Card tags, and JSON-LD data.

## Using the Output with LLMs

The semantic Markdown produced by this library is optimized for use with Large Language Models (LLMs). To use it effectively:

1.  Extract the Markdown content using the library.
2.  Start with a brief instruction or context for the LLM.
3.  Wrap the extracted Markdown in triple backticks (`` `).
4.  Follow the Markdown with your question or prompt.

Example:

````
The following is a semantic Markdown representation of a webpage. Please analyze its content:

```markdown
{paste your extracted markdown here}
```

{your question, e.g., "What are the main points discussed in this article?"}
````

This format helps the LLM understand its task and the context of the content, enabling more accurate and relevant responses to your questions.
