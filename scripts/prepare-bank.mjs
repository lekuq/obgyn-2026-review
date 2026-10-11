import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSearchTerms } from './search-terms.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const bankIndex = args.indexOf('--bank')
const bankId = bankIndex >= 0 ? args[bankIndex + 1] : 'sz-clinical-2026'
if (!bankId) {
  console.error('Missing bank id. Use --bank <bank-id>.')
  process.exit(1)
}

const bankDir = resolve(root, 'banks', bankId)
const outputDir = resolve(root, 'app/src/generated')
const bank = JSON.parse(await readFile(resolve(bankDir, 'bank.json'), 'utf8'))
const questions = JSON.parse(await readFile(resolve(bankDir, 'questions.json'), 'utf8'))

if (bank.bankId !== bankId) {
  console.error(`Bank id mismatch: requested ${bankId}, file says ${bank.bankId}`)
  process.exit(1)
}
if (questions.length !== bank.questionCount) {
  console.error(`Question count mismatch: batch has ${questions.length}, bank.json says ${bank.questionCount}`)
  process.exit(1)
}

const errors = []
const ids = new Set()
for (const [index, question] of questions.entries()) {
  const label = `第 ${index + 1} 题（id=${question.id}）`
  if (!question.id || ids.has(question.id)) errors.push(`${label} ID 为空或重复`)
  ids.add(question.id)
  if (!question.stem?.trim()) errors.push(`${label} 题干为空`)
  if (!Array.isArray(question.options) || question.options.length < 2) errors.push(`${label} 选项不足`)
  if (!Array.isArray(question.answer) || question.answer.length === 0) errors.push(`${label} 答案为空`)
  if (question.answer?.some((answer) => !question.options?.some((option) => option.key === answer))) {
    errors.push(`${label} 答案不存在于选项中`)
  }
  if (!question.explanation?.trim()) errors.push(`${label} 解析为空`)
  if (!question.searchTerms?.length) {
    question.searchTerms = buildSearchTerms(question)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

questions.sort((a, b) => Number(a.id) - Number(b.id))
await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'bank.json'), `${JSON.stringify(bank, null, 2)}\n`, 'utf8')
await writeFile(resolve(outputDir, 'questions.json'), `${JSON.stringify(questions, null, 2)}\n`, 'utf8')
console.log(`Prepared ${bankId}: ${questions.length} questions`)
