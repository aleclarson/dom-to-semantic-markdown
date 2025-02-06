import type { SemanticMarkdownAST } from '../types/markdownTypes'
import { escapeMarkdownCharacters } from './domUtils'

export function extractMetaData(elem: Element, mode?: 'basic' | 'extended') {
  const content = Object.create(null)
  const setContent = (
    type: keyof SemanticMarkdownAST.MetaDataNode['content'],
    key: string | Record<string, any>[],
    value?: string,
  ) => {
    if (type === 'jsonLd') {
      content.jsonLd ||= key
    } else {
      content[type] ||= Object.create(null)
      content[type][key as string] = value
    }
  }

  elem.querySelectorAll('title').forEach(titleElem => {
    setContent('standard', 'title', escapeMarkdownCharacters(titleElem.text))
  })

  // Extract meta tags
  const metaTags = elem.querySelectorAll('meta')
  const nonSemanticTagNames = [
    'viewport',
    'referrer',
    'Content-Security-Policy',
  ]
  metaTags.forEach(metaTag => {
    const content = metaTag.getAttribute('content')
    if (!content) {
      return
    }

    const property = metaTag.getAttribute('property')
    const name = metaTag.getAttribute('name')

    if (property?.startsWith('og:')) {
      if (mode === 'extended') {
        setContent('openGraph', property.substring(3), content)
      }
    } else if (name?.startsWith('twitter:')) {
      if (mode === 'extended') {
        setContent('twitter', name.substring(8), content)
      }
    } else if (name && !nonSemanticTagNames.includes(name)) {
      setContent('standard', name, content)
    }
  })

  // Extract JSON-LD data
  if (mode === 'extended') {
    // Search the entire document since the head or body may have them.
    const jsonLDScripts = elem.ownerDocument.documentElement.querySelectorAll(
      'script[type="application/ld+json"]',
    )

    jsonLDScripts.forEach(script => {
      try {
        const jsonContent = script.textContent
        if (jsonContent) {
          let parsedContent = JSON.parse(jsonContent)
          if (!Array.isArray(parsedContent)) {
            parsedContent = [parsedContent]
          }
          setContent('jsonLd', parsedContent)
        }
      } catch (error) {
        console.error('Failed to parse JSON-LD', error)
      }
    })
  }

  return content as SemanticMarkdownAST.MetaDataNode['content']
}
