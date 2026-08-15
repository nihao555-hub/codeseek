/**
 * 把工作区内的询盘附件读成文本。不引入 npm 依赖：纯文本直接读，docx/xlsx 走 unzip。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve, relative, isAbsolute } from 'node:path'

const TEXT_EXT = new Set(['.md', '.txt', '.csv', '.json', '.html', '.htm', '.xml', '.yml', '.yaml', '.log', '.tsv'])
const MAX_BYTES = 2 * 1024 * 1024
const MAX_CHARS = 80_000

export function workspaceRoot() {
  return resolve(process.env.DSH_WORKSPACE || process.cwd())
}

export function assertWorkspaceFile(inputPath) {
  const root = workspaceRoot()
  const resolved = resolve(isAbsolute(inputPath) ? inputPath : `${root}/${inputPath}`)
  const rel = relative(root, resolved)
  if (rel.startsWith('..') || rel.includes('\0')) {
    throw new Error(`path outside workspace: ${inputPath}`)
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new Error(`not a file: ${resolved}`)
  }
  const size = statSync(resolved).size
  if (size > MAX_BYTES) throw new Error(`file too large (${size} bytes, max ${MAX_BYTES})`)
  return resolved
}

function clip(text) {
  const body = String(text || '').replace(/\u0000/g, '')
  if (body.length <= MAX_CHARS) return body
  return `${body.slice(0, MAX_CHARS)}\n\n[truncated at ${MAX_CHARS} characters]`
}

function stripXml(xml) {
  return clip(String(xml || '')
    .replace(/<w:tab\b[^/]*\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim())
}

function unzipMember(filePath, member) {
  try {
    return execFileSync('unzip', ['-p', filePath, member], {
      encoding: 'utf8',
      maxBuffer: MAX_BYTES,
      timeout: 15000,
    })
  } catch (error) {
    throw new Error(`unzip ${member} failed: ${error.stderr || error.message}`)
  }
}

function extractPdf(filePath) {
  try {
    return clip(execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-'], {
      encoding: 'utf8',
      maxBuffer: MAX_BYTES,
      timeout: 20000,
    }))
  } catch {
    const raw = readFileSync(filePath)
    const strings = []
    const ascii = raw.toString('latin1')
    const matches = ascii.matchAll(/\((?:\\.|[^\\)]){4,}\)/g)
    for (const match of matches) {
      const inner = match[0].slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
      if (/[\x20-\x7e\u00a0-\uffff]{4,}/.test(inner)) strings.push(inner)
    }
    const text = clip(strings.join('\n'))
    if (!text.trim()) throw new Error('PDF has no extractable text (install poppler pdftotext for better results)')
    return text
  }
}

export function readDocument(inputPath) {
  const filePath = assertWorkspaceFile(inputPath)
  const ext = extname(filePath).toLowerCase()
  if (TEXT_EXT.has(ext) || ext === '') {
    return { path: filePath, kind: 'text', text: clip(readFileSync(filePath, 'utf8')) }
  }
  if (ext === '.docx') {
    return { path: filePath, kind: 'docx', text: stripXml(unzipMember(filePath, 'word/document.xml')) }
  }
  if (ext === '.xlsx') {
    let shared = ''
    try { shared = unzipMember(filePath, 'xl/sharedStrings.xml') } catch { shared = '' }
    let sheet = ''
    try { sheet = unzipMember(filePath, 'xl/worksheets/sheet1.xml') } catch { sheet = '' }
    return { path: filePath, kind: 'xlsx', text: clip([stripXml(shared), stripXml(sheet)].filter(Boolean).join('\n')) }
  }
  if (ext === '.pdf') {
    return { path: filePath, kind: 'pdf', text: extractPdf(filePath) }
  }
  throw new Error(`unsupported type ${ext || '(none)'}; use .md .txt .csv .json .docx .xlsx .pdf`)
}
