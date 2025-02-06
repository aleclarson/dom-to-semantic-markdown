export type Node = SemanticMarkdownAST.Node

export declare namespace SemanticMarkdownAST {
  export type BoldNode = {
    type: 'bold'
    content: string | Node[]
  }
  export type ItalicNode = {
    type: 'italic'
    content: string | Node[]
  }
  export type StrikethroughNode = {
    type: 'strikethrough'
    content: string | Node[]
  }
  // Define heading levels
  export type HeadingNode = {
    type: 'heading'
    level: 1 | 2 | 3 | 4 | 5 | 6
    content: string | Node[]
  }
  // Define links and images
  export type LinkNode = {
    type: 'link'
    href: string
    content: Node[]
  }
  export type ImageNode = {
    type: 'image'
    src: string
    alt?: string
  }
  // Define lists
  export type ListItemNode = {
    type: 'listItem'
    content: Node[]
  }
  export type ListNode = {
    type: 'list'
    ordered: boolean
    items: ListItemNode[]
  }
  // Define tables
  export type TableCellNode = {
    type: 'tableCell'
    content: string | Node[]
    colId?: string // Add column ID to TableCell
    colspan?: number
    rowspan?: number
  }
  export type TableRowNode = {
    type: 'tableRow'
    cells: TableCellNode[]
  }
  export type TableNode = {
    type: 'table'
    rows: TableRowNode[]
    colIds?: string[] // Add column IDs to TableElement
  }
  // Define code elements
  export type CodeNode = {
    type: 'code'
    language?: string
    content: string
    inline: boolean
  }
  // Define blockquotes
  export type BlockquoteNode = {
    type: 'blockquote'
    content: Node[]
  }
  export type CustomNode = {
    type: 'custom'
    content: any
  }
  // Define semantic HTML elements (like header, footer)
  export type SemanticHtmlNode = {
    type: 'semanticHtml'
    htmlType:
      | 'article'
      | 'aside'
      | 'details'
      | 'figcaption'
      | 'figure'
      | 'footer'
      | 'header'
      | 'main'
      | 'mark'
      | 'nav'
      | 'section'
      | 'summary'
      | 'time'
    content: Node[]
  }
  export type VideoNode = {
    type: 'video'
    src: string
    poster?: string
    controls?: boolean
  }
  export type TextNode = {
    type: 'text'
    content: string
  }

  export type MetaDataNode = {
    type: 'meta'
    content: {
      /**
       * Standard meta tags (key-value pairs)
       */
      standard?: Record<string, string>
      /**
       * Open Graph tags (key-value pairs)
       */
      openGraph?: Record<string, string>
      /**
       * Twitter Card tags (key-value pairs)
       */
      twitter?: Record<string, string>
      /**
       * JSON-LD data
       */
      jsonLd?: Record<string, any>[]
    }
  }

  export type Node =
    | TextNode
    | BoldNode
    | ItalicNode
    | StrikethroughNode
    | HeadingNode
    | LinkNode
    | ImageNode
    | VideoNode
    | ListNode
    | TableNode
    | CodeNode
    | BlockquoteNode
    | SemanticHtmlNode
    | CustomNode
    | MetaDataNode
}

export interface ExtractOptions {
  /**
   * The domain of the website, used to create relative links for images and links.
   */
  websiteDomain?: string
  /**
   * Controls whether to include metadata extracted from the HTML head.
   * - `'basic'`: Includes standard meta tags like title, description, and keywords.
   * - `'extended'`: Includes basic meta tags, Open Graph tags, Twitter Card tags, and JSON-LD data.
   * - `false`: Disables metadata extraction.
   */
  includeMetaData?: 'basic' | 'extended' | false
  /**
   * Avoid extracting content from these tags.
   */
  excludeTagNames?: string[]
  /**
   * Whether to check elements for visibility before extracting.
   */
  excludeInvisibleElements?: boolean
  /**
   * Enables adding correlational IDs to table cells in the Markdown output.
   */
  enableTableColumnTracking?: boolean
  /**
   * Provides a function to override the default element processing logic.
   */
  overrideElementProcessing?: (
    element: Element,
    options: ConversionOptions,
    indentLevel: number,
  ) => Node[] | false | undefined
  /**
   * Provides a function to process unhandled HTML elements.
   */
  processUnhandledElement?: (
    element: Element,
    options: ConversionOptions,
    indentLevel: number,
  ) => Node[] | undefined
}

export interface RenderOptions {
  /**
   * Include the metadata as “front matter” in the output.
   */
  emitFrontMatter?: boolean
  /**
   * Provides a function to override the default node rendering logic.
   */
  overrideNodeRenderer?: (
    node: Node,
    options: ConversionOptions,
    indentLevel: number,
  ) => string | undefined
  /**
   * Provides a function to render custom nodes.
   */
  renderCustomNode?: (
    node: SemanticMarkdownAST.CustomNode,
    options: ConversionOptions,
    indentLevel: number,
  ) => string | undefined
}

export interface ConversionOptions extends ExtractOptions, RenderOptions {
  /**
   * Whether to convert URLs to a shorter reference format.
   */
  refifyUrls?: boolean
  /**
   * A map of URL references to their original values, generated when `refifyUrls` is enabled.
   */
  urlMap?: Record<string, string>
}
