import type {
  ExtractOptions,
  Node as MarkdownNode,
} from '../types/markdownTypes'
import { escapeMarkdownCharacters } from './domUtils'
import { _Node } from './ElementNode'
import { extractMetaData } from './extractMetaData'

const paragraphBreak: MarkdownNode = Object.freeze({
  type: 'text',
  content: '\n\n',
})

export function htmlToMarkdownAST(
  element: Element,
  options?: ExtractOptions,
  indentLevel = 0,
): MarkdownNode[] {
  const result: MarkdownNode[] = []
  const debugLog = options?.debug ? console.log : () => {}

  const processChild = (child: Node) => {
    if (isTextNode(child)) {
      const textContent = escapeMarkdownCharacters(
        child.textContent?.trim() ?? '',
      )
      if (textContent) {
        debugLog(`Text Node: '${textContent}'`)
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
    const overriddenElementProcessing = options?.overrideElementProcessing?.(
      child,
      options,
      indentLevel,
    )
    if (overriddenElementProcessing) {
      debugLog(`Element Processing Overridden: '${child.nodeType}'`)
      result.push(...overriddenElementProcessing)
    } else {
      if (options?.excludeTagNames?.includes(child.tagName.toLowerCase())) {
        return
      }
      if (
        child.tagName.toLowerCase() === 'head' &&
        !!options?.includeMetaData
      ) {
        const metaData = extractMetaData(child, options.includeMetaData)
        result.push({ type: 'meta', content: metaData })
        return
      }
      if (options?.excludeInvisibleElements && !isElementVisible(child)) {
        return
      }
      if (/^h[1-6]$/i.test(child.tagName)) {
        const level = Number.parseInt(child.tagName.substring(1)) as
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
        debugLog(`Heading ${level}`)
        result.push({
          type: 'heading',
          level,
          content: htmlToMarkdownAST(child, options), // Process child elements
        })
      } else if (child.tagName.toLowerCase() === 'p') {
        debugLog('Paragraph')
        result.push(...htmlToMarkdownAST(child, options))
        // Add a new line after the paragraph
        result.push(paragraphBreak)
      } else if (child.tagName.toLowerCase() === 'a') {
        debugLog(
          `Link: '${(child as HTMLAnchorElement).href}' with text '${child.textContent}'`,
        )
        // Check if the href is a data URL for an image
        if (
          typeof (child as HTMLAnchorElement).href === 'string' &&
          (child as HTMLAnchorElement).href.startsWith('data:image')
        ) {
          // If it's a data URL for an image, skip this link
          result.push({
            type: 'link',
            href: '-',
            content: htmlToMarkdownAST(child, options),
          })
        } else {
          // Process the link as usual
          let href = (child as HTMLAnchorElement).href
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
            Array.from(child.childNodes).every(
              _ => _.nodeType === _Node.TEXT_NODE,
            )
          ) {
            result.push({
              type: 'link',
              href: href,
              content: [
                { type: 'text', content: child.textContent?.trim() ?? '' },
              ],
            })
          } else {
            result.push({
              type: 'link',
              href: href,
              content: htmlToMarkdownAST(child, options),
            })
          }
        }
      } else if (child.tagName.toLowerCase() === 'img') {
        debugLog(
          `Image: src='${(child as HTMLImageElement).src}', alt='${(child as HTMLImageElement).alt}'`,
        )
        if ((child as HTMLImageElement).src?.startsWith('data:image')) {
          result.push({
            type: 'image',
            src: '-',
            alt: escapeMarkdownCharacters((child as HTMLImageElement).alt),
          })
        } else {
          const src =
            options?.websiteDomain &&
            (child as HTMLImageElement).src?.startsWith(options.websiteDomain)
              ? (child as HTMLImageElement).src?.substring(
                  options.websiteDomain.length,
                )
              : (child as HTMLImageElement).src
          result.push({
            type: 'image',
            src,
            alt: escapeMarkdownCharacters((child as HTMLImageElement).alt),
          })
        }
      } else if (child.tagName.toLowerCase() === 'video') {
        debugLog(
          `Video: src='${(child as HTMLVideoElement).src}', poster='${(child as HTMLVideoElement).poster}', controls='${(child as HTMLVideoElement).controls}'`,
        )
        result.push({
          type: 'video',
          src: (child as HTMLVideoElement).src,
          poster: escapeMarkdownCharacters((child as HTMLVideoElement).poster),
          controls: (child as HTMLVideoElement).controls,
        })
      } else if (
        child.tagName.toLowerCase() === 'ul' ||
        child.tagName.toLowerCase() === 'ol'
      ) {
        debugLog(
          `${child.tagName.toLowerCase() === 'ul' ? 'Unordered' : 'Ordered'} List`,
        )
        result.push({
          type: 'list',
          ordered: child.tagName.toLowerCase() === 'ol',
          items: Array.from(child.children).map(li => ({
            type: 'listItem',
            content: htmlToMarkdownAST(li, options, indentLevel + 1),
          })),
        })
      } else if (child.tagName.toLowerCase() === 'br') {
        debugLog('Line Break')
        result.push({ type: 'text', content: '\n' })
      } else if (child.tagName.toLowerCase() === 'table') {
        debugLog('Table')

        const colIds: string[] = []

        if (options?.enableTableColumnTracking) {
          // Generate unique column IDs
          const headerCells = Array.from(child.querySelectorAll('th, td'))
          headerCells.forEach((_, index) => {
            colIds.push(`col-${index}`)
          })
        }

        const tableRows = Array.from(child.querySelectorAll('tr'))
        const markdownTableRows = tableRows.map(row => {
          let columnIndex = 0
          const cells = Array.from(row.querySelectorAll('th, td')).map(cell => {
            const colspan = Number.parseInt(
              cell.getAttribute('colspan') || '1',
              10,
            )
            const rowspan = Number.parseInt(
              cell.getAttribute('rowspan') || '1',
              10,
            )
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
      } else {
        const content = escapeMarkdownCharacters(child.textContent || '')
        switch (child.tagName.toLowerCase()) {
          case 'noscript':
          case 'script':
          case 'style':
          case 'html':
            // blackhole..
            break
          case 'strong':
          case 'b':
            if (content) {
              debugLog(`Bold: '${content}'`)
              result.push({
                type: 'bold',
                content: htmlToMarkdownAST(child, options, indentLevel + 1),
              })
            }
            break
          case 'em':
          case 'i':
            if (content) {
              debugLog(`Italic: '${content}'`)
              result.push({
                type: 'italic',
                content: htmlToMarkdownAST(child, options, indentLevel + 1),
              })
            }
            break
          case 's':
          case 'strike':
            if (content) {
              debugLog(`Strikethrough: '${content}'`)
              result.push({
                type: 'strikethrough',
                content: htmlToMarkdownAST(child, options, indentLevel + 1),
              })
            }
            break
          case 'code':
            if (content) {
              // Handling inline code differently
              const isCodeBlock =
                child.parentNode &&
                child.parentNode.nodeName.toLowerCase() === 'pre'
              debugLog(
                `${isCodeBlock ? 'Code Block' : 'Inline Code'}: '${content}'`,
              )
              const languageClass = child.className
                ?.split(' ')
                .find(cls => cls.startsWith('language-'))
              const language = languageClass
                ? languageClass.replace('language-', '')
                : ''
              result.push({
                type: 'code',
                content: child.textContent?.trim() ?? '',
                language,
                inline: !isCodeBlock,
              })
            }
            break
          case 'blockquote':
            debugLog('Blockquote')
            result.push({
              type: 'blockquote',
              content: htmlToMarkdownAST(child, options),
            })
            break
          case 'article':
          case 'aside':
          case 'details':
          case 'figcaption':
          case 'figure':
          case 'footer':
          case 'header':
          case 'main':
          case 'mark':
          case 'nav':
          case 'section':
          case 'summary':
          case 'time':
            debugLog(`Semantic HTML Element: '${child.tagName}'`)
            result.push({
              type: 'semanticHtml',
              htmlType: child.tagName.toLowerCase() as any,
              content: htmlToMarkdownAST(child, options),
            })
            break
          default: {
            const unhandledElementProcessing =
              options?.processUnhandledElement?.(child, options, indentLevel)
            if (unhandledElementProcessing) {
              debugLog(`Processing Unhandled Element: '${child.tagName}'`)
              result.push(...unhandledElementProcessing)
            } else {
              debugLog(`Generic HTMLElement: '${child.tagName}'`)
              result.push(...htmlToMarkdownAST(child, options, indentLevel + 1))
            }
            break
          }
        }
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
    return element.offsetWidth > 0 && element.offsetHeight > 0
  }
  // SVG elements are visible, I guess.
  return true
}
