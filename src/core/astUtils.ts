import type { Node } from '../types/markdownTypes'

export const getMainContent = (markdownStr: string) => {
  if (markdownStr.includes('<-main->')) {
    const regex = /(?<=<-main->)[\s\S]*?(?=<\/-main->)/
    const match = markdownStr.match(regex)
    return match?.[0] ?? ''
  }
  const removeSectionsRegex =
    /(<-nav->[\s\S]*?<\/-nav->)|(<-footer->[\s\S]*?<\/-footer->)|(<-header->[\s\S]*?<\/-header->)|(<-aside->[\s\S]*?<\/-aside->)/g

  return markdownStr.replace(removeSectionsRegex, '')
}

export const isNot =
  <T, U>(tPred: (t: T | U) => t is T) =>
  (t: T | U): t is Exclude<U, T> =>
    !tPred(t)

const isString = (x: any): x is string => typeof x === 'string'

export function findInAST(
  markdownElement: Node | Node[],
  checker: (markdownElement: Node) => boolean,
): Node | undefined {
  const loopCheck = (z: Node[]): Node | undefined => {
    for (const element of z) {
      const found = findInAST(element, checker)
      if (found) {
        return found
      }
    }
    return undefined
  }
  if (Array.isArray(markdownElement)) {
    return loopCheck(markdownElement)
  }
  if (checker(markdownElement)) {
    return markdownElement
  }
  switch (markdownElement.type) {
    case 'link':
      return loopCheck(markdownElement.content)
    case 'list':
      return loopCheck(markdownElement.items.flatMap(_ => _.content))
    case 'table':
      return loopCheck(
        markdownElement.rows.flatMap(row =>
          row.cells.map(_ => _.content).filter(isNot(isString)),
        ),
      )
    case 'blockquote':
    case 'semanticHtml':
      return loopCheck(markdownElement.content)
  }

  return undefined
}

export function findAllInAST(
  markdownElement: Node | Node[],
  checker: (markdownElement: Node) => boolean,
): Node[] {
  const loopCheck = (z: Node[]): Node[] => {
    let out: Node[] = []
    for (const element of z) {
      const found = findAllInAST(element, checker)
      out = [...out, ...found]
    }
    return out
  }
  if (Array.isArray(markdownElement)) {
    return loopCheck(markdownElement)
  }
  if (checker(markdownElement)) {
    return [markdownElement]
  }
  switch (markdownElement.type) {
    case 'link':
      return loopCheck(markdownElement.content)
    case 'list':
      return loopCheck(markdownElement.items.flatMap(_ => _.content))
    case 'table':
      return loopCheck(
        markdownElement.rows.flatMap(row =>
          row.cells.map(_ => _.content).filter(isNot(isString)),
        ),
      )
    case 'blockquote':
    case 'semanticHtml':
      return loopCheck(markdownElement.content)
  }

  return []
}
