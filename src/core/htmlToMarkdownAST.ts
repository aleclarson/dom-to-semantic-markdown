import type {
  ExtractOptions,
  Node as MarkdownNode,
  SemanticMarkdownAST,
} from '../types/markdownTypes'
import { escapeMarkdownCharacters } from './domUtils'
import { _Node } from './ElementNode'
import { extractMetaData } from './extractMetaData'

const noop = () => {}

const lineBreak: MarkdownNode = Object.freeze({
  type: 'text',
  content: '\n',
})

const contentBreak: MarkdownNode = Object.freeze({
  type: 'text',
  content: '\n\n',
})

type ElementTranslator<T extends keyof HTMLElementTagNameMap> = (
  element: HTMLElementTagNameMap[T],
  result: MarkdownNode[],
  options: ExtractOptions | undefined,
  indentLevel: number,
) => void

const headingTranslator: ElementTranslator<
  'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
> = (headingNode, result, options) => {
  const level = Number.parseInt(
    headingNode.tagName.substring(1),
  ) as SemanticMarkdownAST.HeadingNode['level']

  result.push({
    type: 'heading',
    level,
    content: htmlToMarkdownAST(headingNode, options),
  })
}

const listTranslator: ElementTranslator<'ul' | 'ol'> = (
  listNode,
  result,
  options,
  indentLevel,
) => {
  result.push({
    type: 'list',
    ordered: listNode.tagName === 'OL',
    items: Array.from(listNode.children).map(li => ({
      type: 'listItem',
      content: htmlToMarkdownAST(li, options, indentLevel + 1),
    })),
  })
}

const semanticHtmlTranslator: ElementTranslator<any> = (
  element: Element,
  result,
  options,
) => {
  result.push({
    type: 'semanticHtml',
    htmlType: element.tagName.toLowerCase() as any,
    content: htmlToMarkdownAST(element, options),
  })
}

const formattingTagMap = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  s: 'strikethrough',
} as const

const formattingTranslator: ElementTranslator<keyof typeof formattingTagMap> = (
  element,
  result,
  options,
  indentLevel,
) => {
  if (element.textContent?.trim()) {
    const key = element.tagName.toLowerCase() as keyof typeof formattingTagMap
    result.push({
      type: formattingTagMap[key],
      content: htmlToMarkdownAST(element, options, indentLevel + 1),
    })
  }
}

type ElementTranslatorMap = {
  [K in keyof HTMLElementTagNameMap]?: ElementTranslator<K>
}

const translators: ElementTranslatorMap = {
  // Paragraphs
  p(paragraphNode, result, options) {
    const content = htmlToMarkdownAST(paragraphNode, options)
    if (!content.length) {
      return
    }
    for (const node of content) {
      result.push(node)
    }
    result.push(contentBreak)
  },

  // Links
  a(linkNode, result, options) {
    // Check if the href is a data URL for an image
    if (
      typeof linkNode.href === 'string' &&
      linkNode.href.startsWith('data:image')
    ) {
      // If it's a data URL for an image, skip this link
      result.push({
        type: 'link',
        href: '-',
        content: htmlToMarkdownAST(linkNode, options),
      })
    } else {
      // Process the link as usual
      let href = linkNode.href
      if (typeof href === 'string') {
        href =
          options?.websiteDomain && href.startsWith(options.websiteDomain)
            ? href.substring(options.websiteDomain.length)
            : href
      } else {
        href = '#' // Use a default value when href is not a string
      }
      // if all children are text,
      if (
        Array.from(linkNode.childNodes).every(
          _ => _.nodeType === _Node.TEXT_NODE,
        )
      ) {
        result.push({
          type: 'link',
          href: href,
          content: [
            { type: 'text', content: linkNode.textContent?.trim() ?? '' },
          ],
        })
      } else {
        const content = htmlToMarkdownAST(linkNode, options)
        if (!content.length) {
          return
        }
        result.push({
          type: 'link',
          href: href,
          content,
        })
      }
    }
  },

  // Images
  img(imageNode, result, options) {
    if (imageNode.src?.startsWith('data:image')) {
      result.push({
        type: 'image',
        src: '-',
        alt: escapeMarkdownCharacters(imageNode.alt),
      })
    } else {
      const src =
        options?.websiteDomain &&
        imageNode.src?.startsWith(options.websiteDomain)
          ? imageNode.src?.substring(options.websiteDomain.length)
          : imageNode.src

      result.push({
        type: 'image',
        src,
        alt: escapeMarkdownCharacters(imageNode.alt),
      })
    }
  },

  // Videos
  video(videoNode, result) {
    result.push({
      type: 'video',
      src: videoNode.src,
      poster: escapeMarkdownCharacters(videoNode.poster),
      controls: videoNode.controls,
    })
  },

  // Line breaks
  br(_, result) {
    result.push(lineBreak)
  },

  // Content breaks
  hr(_, result) {
    result.push(contentBreak)
  },

  // Tables
  table(tableNode, result, options, indentLevel) {
    const colIds: string[] = []

    if (options?.enableTableColumnTracking) {
      // Generate unique column IDs
      const headerCells = Array.from(tableNode.querySelectorAll('th, td'))
      headerCells.forEach((_, index) => {
        colIds.push(`col-${index}`)
      })
    }

    const tableRows = Array.from(tableNode.querySelectorAll('tr'))
    const markdownTableRows = tableRows.map(row => {
      let columnIndex = 0
      const cells = Array.from(row.querySelectorAll('th, td')).map(cell => {
        const colspan = Number.parseInt(cell.getAttribute('colspan') || '1', 10)
        const rowspan = Number.parseInt(cell.getAttribute('rowspan') || '1', 10)
        const cellNode = {
          type: 'tableCell' as const,
          content:
            cell.nodeType === _Node.TEXT_NODE
              ? escapeMarkdownCharacters(cell.textContent?.trim() ?? '')
              : htmlToMarkdownAST(cell, options, indentLevel + 1),
          colId: colIds[columnIndex] as string | undefined,
          colspan: colspan > 1 ? colspan : undefined,
          rowspan: rowspan > 1 ? rowspan : undefined,
        }
        columnIndex += colspan
        return cellNode
      })
      return { type: 'tableRow' as const, cells }
    })

    if (markdownTableRows.length > 0) {
      // Check if the first row contains header cells
      const hasHeaders = tableRows[0].querySelector('th') !== null
      if (hasHeaders) {
        // Create a header separator row
        const headerSeparatorCells = Array.from(
          tableRows[0].querySelectorAll('th, td'),
        ).map(() => ({
          type: 'tableCell' as const,
          content: '---',
          colId: undefined,
          colspan: undefined,
          rowspan: undefined,
        }))
        const headerSeparatorRow = {
          type: 'tableRow' as const,
          cells: headerSeparatorCells,
        }
        markdownTableRows.splice(1, 0, headerSeparatorRow)
      }
    }

    result.push({ type: 'table', rows: markdownTableRows, colIds })
  },

  // Quotations
  blockquote(quoteNode, result, options) {
    result.push({
      type: 'blockquote',
      content: htmlToMarkdownAST(quoteNode, options),
    })
  },

  // Code blocks
  code(codeNode, result) {
    const content = codeNode.textContent?.trim()
    if (!content) {
      return
    }
    let language: string | undefined
    for (const className of codeNode.classList.values()) {
      if (className.startsWith('language-')) {
        language = className.replace('language-', '')
        break
      }
    }
    result.push({
      type: 'code',
      content,
      language,
      // Handling inline code differently
      inline: codeNode.parentNode?.nodeName !== 'PRE',
    })
  },

  // Headings
  h1: headingTranslator,
  h2: headingTranslator,
  h3: headingTranslator,
  h4: headingTranslator,
  h5: headingTranslator,
  h6: headingTranslator,

  // Lists
  ul: listTranslator,
  ol: listTranslator,

  // Text formatting
  strong: formattingTranslator,
  b: formattingTranslator,
  em: formattingTranslator,
  i: formattingTranslator,
  s: formattingTranslator,

  // Semantic HTML elements
  article: semanticHtmlTranslator,
  aside: semanticHtmlTranslator,
  details: semanticHtmlTranslator,
  figcaption: semanticHtmlTranslator,
  figure: semanticHtmlTranslator,
  footer: semanticHtmlTranslator,
  header: semanticHtmlTranslator,
  main: semanticHtmlTranslator,
  mark: semanticHtmlTranslator,
  nav: semanticHtmlTranslator,
  section: semanticHtmlTranslator,
  summary: semanticHtmlTranslator,
  time: semanticHtmlTranslator,

  // Ignored elements
  noscript: noop,
  script: noop,
  style: noop,
  html: noop,
}

export function htmlToMarkdownAST(
  element: Element,
  options?: ExtractOptions,
  indentLevel = 0,
): MarkdownNode[] {
  const result: MarkdownNode[] = []

  const processChild = (child: Node) => {
    if (isTextNode(child)) {
      const textContent = escapeMarkdownCharacters(
        child.textContent?.trim() ?? '',
      )
      if (textContent) {
        result.push({
          type: 'text',
          content: textContent,
        })
      }
      return
    }
    if (!isElement(child)) {
      return
    }
    if (isSlotElement(child)) {
      return child.assignedNodes().forEach(processChild)
    }
    const overrideResult = options?.overrideElementProcessing?.(
      child,
      options,
      indentLevel,
    )
    if (overrideResult !== undefined) {
      if (overrideResult !== false) {
        result.push(...overrideResult)
      }
    } else {
      const tagName = child.tagName.toLowerCase()

      if (options?.excludeTagNames?.includes(tagName)) {
        return
      }

      if (options?.includeMetaData && tagName === 'head') {
        const metaData = extractMetaData(child, options.includeMetaData)
        result.push({ type: 'meta', content: metaData })
        return
      }

      if (options?.excludeInvisibleElements && !isElementVisible(child)) {
        return
      }

      const translator = translators[
        tagName as keyof typeof translators
      ] as ElementTranslator<any>

      if (translator) {
        translator(child, result, options, indentLevel)
        return
      }

      const unhandledElementProcessing = options?.processUnhandledElement?.(
        child,
        options,
        indentLevel,
      )
      if (unhandledElementProcessing) {
        result.push(...unhandledElementProcessing)
      } else {
        result.push(...htmlToMarkdownAST(child, options, indentLevel + 1))
      }
    }
  }

  const childNodes = element.shadowRoot?.childNodes ?? element.childNodes
  childNodes.forEach(processChild)

  return result
}

function isTextNode(node: Node): node is Text {
  return node.nodeType === _Node.TEXT_NODE
}

function isElement(node: Node): node is Element {
  return node.nodeType === _Node.ELEMENT_NODE
}

function isSlotElement(element: Element): element is HTMLSlotElement {
  return element.tagName === 'SLOT'
}

function isElementVisible(element: Element) {
  if (element instanceof HTMLElement) {
    return element.offsetWidth !== 0 || element.offsetHeight !== 0
  }
  // SVG elements are visible, I guess.
  return true
}
