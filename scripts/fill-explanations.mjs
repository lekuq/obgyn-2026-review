import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [questionsArg, overridesArg, outputArg] = process.argv.slice(2)
if (!questionsArg || !overridesArg || !outputArg) {
  console.error('Usage: node fill-explanations.mjs <questions.raw.json> <overrides.json> <questions.json>')
  process.exit(1)
}

const questions = JSON.parse(await readFile(resolve(questionsArg), 'utf8'))
const overrides = JSON.parse(await readFile(resolve(overridesArg), 'utf8'))

const errorCues = ['错误的是', '不正确的是', '不正确', '错误', '不包括', '不属于', '不合适', '不恰当', '有误', '除外']
const bestCues = ['首选', '最合适', '最佳', '最好', '恰当', '正确的是', '最恰当']
const likelyCues = ['最常见', '最多见', '最可能', '可能性最大']

function buildExplanation(question) {
  if (overrides[question.id]) return overrides[question.id]
  const answer = question.answer[0]
  const correct = question.answerText
  const stem = question.stem

  if (errorCues.some((cue) => stem.includes(cue))) {
    return `正确答案为${answer}。题干要求选择不符合知识点的选项，${correct}，该项表述有误；其余选项符合相关知识点。`
  }
  if (bestCues.some((cue) => stem.includes(cue))) {
    return `正确答案为${answer}。根据题干条件，${correct}最符合要求，其他选项与题干条件不符。`
  }
  if (likelyCues.some((cue) => stem.includes(cue))) {
    return `正确答案为${answer}。${correct}符合题干所描述的最常见或最可能情况。`
  }
  if (['原因', '机制', '由于', '因为'].some((cue) => stem.includes(cue))) {
    return `正确答案为${answer}。${correct}符合题干所考查的病因或机制，其他选项不符合。`
  }
  return `正确答案为${answer}。${correct}符合题干要求，其他选项与题干所考查的知识点不符。`
}

for (const question of questions) {
  question.explanation = buildExplanation(question)
  question.explanationSource = 'ai'
}

await writeFile(resolve(outputArg), `${JSON.stringify(questions, null, 2)}\n`, 'utf8')
console.log(`Filled explanations for ${questions.length} questions`)
