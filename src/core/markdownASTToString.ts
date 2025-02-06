import { findInMarkdownAST } from '../index'
import type {
  ConversionOptions,
  Node,
  RenderOptions,
} from '../types/markdownTypes'

export function markdownASTToString(
  nodes: Node[],
  options?: RenderOptions,
  indentLevel = 0,
): string {
  let markdownString = ''
  markdownString += markdownMetaASTToString(nodes, options)
  markdownString += markdownContentASTToString(nodes, options, indentLevel)
  return markdownString
}

function markdownMetaASTToString(
  nodes: Node[],
  options?: RenderOptions,
): string {
  let markdownString = ''

  if (options?.emitFrontMatter) {
    const node = findInMarkdownAST(nodes, _ => _.type === 'meta')
    if (node?.type === 'meta') {
      if (node.content.standard) {
        Object.entries(node.content.standard).forEach(([key, value]) => {
          markdownString += `${key}: ${JSON.stringify(value)}\n`
        })
      }

      if (node.content.openGraph) {
        markdownString += 'openGraph:\n'
        Object.entries(node.content.openGraph).forEach(([key, value]) => {
          markdownString += `  ${key}: ${JSON.stringify(value)}\n`
        })
      }

      if (node.content.twitter) {
        markdownString += 'twitter:\n'
        Object.entries(node.content.twitter).forEach(([key, value]) => {
          markdownString += `  ${key}: ${JSON.stringify(value)}\n`
        })
      }

      if (node.content.jsonLd) {
        markdownString += 'schema:\n'
        node.content.jsonLd.forEach(
          ({ '@context': jldContext, '@type': jldType, ...semanticData }) => {
            markdownString += `  ${jldType ?? '(unknown type)'}:\n`
            Object.keys(semanticData).forEach(key => {
              markdownString += `    ${key}: ${JSON.stringify(semanticData[key])}\n`
            })
          },
        )
      }
    }

    if (markdownString.length > 0) {
      markdownString = '---\n' + markdownString + '---\n\n'
    }
  }

  return markdownString
}

function markdownContentASTToString(
  nodes: Node[],
  options?: ConversionOptions,
  indentLevel = 0,
): string {
  let markdownString = ''

  nodes.forEach(node => {
    const indent = ' '.repeat(indentLevel * 2) // Adjust the multiplier for different indent sizes

    const nodeRenderingOverride = options?.overrideNodeRenderer?.(
      node,
      options,
      indentLevel,
    )
    if (nodeRenderingOverride) {
      markdownString += nodeRenderingOverride
    } else {
      switch (node.type) {
        case 'text':
        case 'bold':
        case 'italic':
        case 'strikethrough':
        case 'link': {
          let content = node.content as string // might be a nodes array but we take care of that below
          if (Array.isArray(node.content)) {
            content = markdownContentASTToString(
              node.content,
              options,
              indentLevel,
            )
          }

          const isMarkdownStringNotEmpty = markdownString.length > 0
          const isFirstCharOfContentWhitespace = /\s/.test(content.charAt(0))
          const isLastCharOfMarkdownWhitespace = /\s/.test(
            markdownString.slice(-1),
          )
          const isContentPunctuation =
            content.length === 1 && /^[.,!?;:]/.test(content)

          if (
            isMarkdownStringNotEmpty &&
            !isContentPunctuation &&
            !isFirstCharOfContentWhitespace &&
            !isLastCharOfMarkdownWhitespace
          ) {
            markdownString += ' '
          }

          if (node.type === 'text') {
            markdownString += `${indent}${content}`
          } else {
            if (node.type === 'bold') {
              markdownString += `**${content}**`
            } else if (node.type === 'italic') {
              markdownString += `*${content}*`
            } else if (node.type === 'strikethrough') {
              markdownString += `~~${content}~~`
            } else if (node.type === 'link') {
              // check if the link contains only text
              if (
                node.content.length === 1 &&
                node.content[0].type === 'text'
              ) {
                // use native markdown syntax for text-only links
                markdownString += `[${content}](${encodeURI(node.href)})`
              } else {
                // Use HTML <a> tag for links with rich content
                markdownString += `<a href="${node.href}">${content}</a>`
              }
            }
          }
          break
        }
        case 'heading': {
          const isEndsWithNewLine = markdownString.slice(-1) === '\n'
          if (!isEndsWithNewLine) {
            markdownString += '\n'
          }
          const headingContent =
            typeof node.content === 'string'
              ? node.content
              : markdownContentASTToString(node.content, options, indentLevel)
          markdownString += `${'#'.repeat(node.level)} ${headingContent}\n\n`
          break
        }
        case 'image':
          if (!node.alt?.trim() || !!node.src?.trim()) {
            markdownString += `![${node.alt || ''}](${node.src})`
          }
          break
        case 'list':
          node.items.forEach((item, i) => {
            const listItemPrefix = node.ordered ? `${i + 1}.` : '-'
            const contents = markdownContentASTToString(
              item.content,
              options,
              indentLevel + 1,
            ).trim()
            if (markdownString.slice(-1) !== '\n') {
              markdownString += '\n'
            }
            if (contents) {
              markdownString += `${indent}${listItemPrefix} ${contents}\n`
            }
          })
          markdownString += '\n'
          break
        case 'video':
          markdownString += `\n![Video](${node.src})\n`
          if (node.poster) {
            markdownString += `![Poster](${node.poster})\n`
          }
          if (node.controls) {
            markdownString += `Controls: ${node.controls}\n`
          }
          markdownString += '\n'
          break
        case 'table': {
          const maxColumns = Math.max(
            ...node.rows.map(row =>
              row.cells.reduce((sum, cell) => sum + (cell.colspan || 1), 0),
            ),
          )

          node.rows.forEach(row => {
            let currentColumn = 0
            row.cells.forEach(cell => {
              let cellContent =
                typeof cell.content === 'string'
                  ? cell.content
                  : markdownContentASTToString(
                      cell.content,
                      options,
                      indentLevel + 1,
                    ).trim()

              if (cell.colId) {
                cellContent += ` <!-- ${cell.colId} -->`
              }

              if (cell.colspan && cell.colspan > 1) {
                cellContent += ` <!-- colspan: ${cell.colspan} -->`
              }

              if (cell.rowspan && cell.rowspan > 1) {
                cellContent += ` <!-- rowspan: ${cell.rowspan} -->`
              }

              markdownString += `| ${cellContent} `
              currentColumn += cell.colspan || 1

              // Add empty cells for colspan
              for (let i = 1; i < (cell.colspan || 1); i++) {
                markdownString += '| '
              }
            })

            // Fill remaining columns with empty cells
            while (currentColumn < maxColumns) {
              markdownString += '|  '
              currentColumn++
            }

            markdownString += '|\n'
          })
          markdownString += '\n'
          break
        }
        case 'code':
          if (node.inline) {
            const isLastWhitespace = /\s/.test(markdownString.slice(-1))
            if (!isLastWhitespace) {
              markdownString += ' '
            }
            markdownString += `\`${node.content}\``
          } else {
            // For code blocks, we do not escape characters and preserve formatting
            markdownString += '\n```' + (node.language ?? '') + '\n'
            markdownString += `${node.content}\n`
            markdownString += '```\n\n'
          }
          break
        case 'blockquote':
          markdownString += `> ${markdownContentASTToString(node.content, options).trim()}\n\n`
          break
        case 'meta':
          // already handled
          break
        case 'semanticHtml':
          switch (node.htmlType) {
            case 'article':
              markdownString +=
                '\n\n' + markdownContentASTToString(node.content, options)
              break
            case 'summary':
            case 'time':
            case 'aside':
            case 'nav':
            case 'figcaption':
            case 'main':
            case 'mark':
            case 'header':
            case 'footer':
            case 'details':
            case 'figure':
              markdownString +=
                `\n\n<-${node.htmlType}->\n` +
                markdownContentASTToString(node.content, options) +
                `\n\n</-${node.htmlType}->\n`
              break
            case 'section':
              markdownString += '---\n\n'
              markdownString += markdownContentASTToString(
                node.content,
                options,
              )
              markdownString += '\n\n'
              markdownString += '---\n\n'
              break
          }
          break
        case 'custom': {
          const customNodeRendering = options?.renderCustomNode?.(
            node,
            options,
            indentLevel,
          )
          if (customNodeRendering) {
            markdownString += customNodeRendering
          }
          break
        }
        default:
          break
      }
    }
  })

  return markdownString
}
