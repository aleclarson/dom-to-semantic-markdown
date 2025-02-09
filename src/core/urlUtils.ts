import type { Node } from '../types/markdownTypes'

const mediaSuffixes = [
  'jpeg',
  'jpg',
  'png',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'svg',
  'webp',
  'ico',
  'avi',
  'mov',
  'mp4',
  'mkv',
  'flv',
  'wmv',
  'webm',
  'mpeg',
  'mpg',
  'mp3',
  'wav',
  'aac',
  'ogg',
  'flac',
  'm4a',
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'css',
  'js',
  'xml',
  'json',
  'html',
  'htm',
]
const addRefPrefix = (
  prefix: string,
  prefixesToRefs: Record<string, string>,
): string => {
  if (!prefixesToRefs[prefix]) {
    prefixesToRefs[prefix] = 'ref' + Object.values(prefixesToRefs).length
  }
  return prefixesToRefs[prefix]
}
const processUrl = (url: string, prefixesToRefs: Record<string, string>) => {
  if (!url.startsWith('http')) {
    return url
  }
  const mediaSuffix = url.split('.').slice(-1)[0]
  if (mediaSuffix && mediaSuffixes.includes(mediaSuffix)) {
    const parts = url.split('/') // Split URL keeping the slash before text
    const prefix = parts.slice(0, -1).join('/') // Get the prefix by removing last part
    const refPrefix = addRefPrefix(prefix, prefixesToRefs)
    return `${refPrefix}://${parts.slice(-1).join('')}`
  }
  if (url.split('/').length > 4) {
    return addRefPrefix(url, prefixesToRefs)
  }
  return url
}

export function refifyUrls(
  markdownElement: Node | Node[],
  urlMap: Record<string, string>,
) {
  if (Array.isArray(markdownElement)) {
    markdownElement.forEach(element => refifyUrls(element, urlMap))
  } else {
    switch (markdownElement.type) {
      case 'link':
        markdownElement.href = processUrl(markdownElement.href, urlMap)
        refifyUrls(markdownElement.content, urlMap)
        break
      case 'image':
      case 'video':
        markdownElement.src = processUrl(markdownElement.src, urlMap)
        break
      case 'list':
        markdownElement.items.forEach(item =>
          item.content.forEach(_ => refifyUrls(_, urlMap)),
        )
        break
      case 'table':
        markdownElement.rows.forEach(row =>
          row.cells.forEach(cell =>
            typeof cell.content === 'string'
              ? null
              : refifyUrls(cell.content, urlMap),
          ),
        )
        break
      case 'blockquote':
      case 'semanticHtml':
        refifyUrls(markdownElement.content, urlMap)
        break
    }
  }
  return urlMap
}
