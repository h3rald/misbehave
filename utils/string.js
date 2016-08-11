"use strict"

import { leadingWhitespace, removeIfStartsWith, onNewLine, allNewLines, allCharacters } from './utils'

export let autoIndent = (newLine, tab, prefix, selected, suffix) => {
  // if surrounding parenthesis, indent to current depth
  // if opening curly brace, indent to current + tab
  // ++ if closing curly, put on own newline, indent to current
  //
  // otherwise indent to leading whitespace
  let prevLine = prefix.split(onNewLine).splice(-1)[0]
  let prefEnd = prefix.slice(-1)
  let suffStart = suffix.charAt(0)
  console.log('prevLine', JSON.stringify(prevLine))
  if (prefEnd === '(' && suffStart === ')') {
    let whitespace = prevLine.match(leadingWhitespace)[0]
    prefix += newLine + whitespace + prevLine.slice(whitespace.length).replace(allCharacters, ' ')
  } else if (prefEnd === '{') {
    prefix += newLine + prevLine.match(leadingWhitespace)[0] + tab
    if (suffStart === '}')
      suffix = newLine + prevLine.match(leadingWhitespace)[0] + suffix
  } else {
    prefix += newLine + prevLine.match(leadingWhitespace)[0]
  }
  selected = ''
  if (suffix === '') suffix = newLine
  return { prefix, selected, suffix }
}

export let autoOpen = (opening, closing, prefix, selected, suffix) => {
  prefix += opening
  suffix = closing + suffix
  return { prefix, selected, suffix }
}

export let autoStrip = (prefix, selected, suffix) => {
  prefix = prefix.slice(0, -1)
  suffix = suffix.slice(1)
  return { prefix, selected, suffix }
}

export let testAutoStrip = (pairs, prefix, selected, suffix) => {
  let result = false
  pairs.forEach(([opening, closing]) => {
    closing = closing ? closing : opening
    if (prefix.slice(-1) === opening && suffix.charAt(0) === closing) result = true
  })
  return result
}

export let overwrite = (closing, prefix, selected, suffix) => {
  prefix += closing
  suffix = suffix.slice(1)
  return { prefix, selected, suffix }
}

export let testOverwrite = (closing, prefix, selected, suffix) => {
  return suffix.charAt(0) === closing
}

export let tabIndent = (newLine, tab, prefix, selected, suffix) => {
  prefix += tab // if softtabs, this should indent to the next even tab width, not blindly add spaces
  selected = selected.replace(allNewLines, newLine + tab)
  return { prefix, selected, suffix }
}

export let tabUnindent = (newLine, tab, prefix, selected, suffix) => {
  let lines = selected.split(onNewLine)
  if (lines.length === 1) {
    if (prefix.endsWith(tab))
      prefix = prefix.slice(0, -tab.length)
    else
      prefix += tab // indent instead
  } else {
    let prevLine = prefix.split(onNewLine).splice(-1)[0]
    let prevLength = prevLine.length

    prevLine = removeIfStartsWith(tab)(prevLine)
    prefix = prefix.slice(0, -prevLength) + prevLine
    lines = lines.map(removeIfStartsWith(tab))
    selected = lines.join(newLine)
  }
  return { prefix, selected, suffix }
}

export default function StrUtil(newLine, tab) {
  return {
    autoIndent    : (...args) => autoIndent(newLine, tab, ...args),
    autoOpen      : autoOpen,
    autoStrip     : autoStrip,
    testAutoStrip : testAutoStrip,
    overwrite     : overwrite,
    testOverwrite : testOverwrite,
    tabIndent     : (...args) => tabIndent(newLine, tab, ...args),
    tabUnindent   : (...args) => tabUnindent(newLine, tab, ...args)
  }
}
