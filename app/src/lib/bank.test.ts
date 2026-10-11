import { describe, expect, test } from 'vitest'
import type { BankConfig, Question } from '@/types/question'
import { validateBank } from './bank'

const config: BankConfig = {
  bankId: 'sz-clinical-2026',
  title: '2026 深圳医师定期考核临床类别复习助手',
  shortName: '??????',
  scopeLabel: '2026 ??????',
  version: '2026.10.05',
  buildDate: '2026-10-05T00:00:00.000Z',
  questionCount: 1,
  examQuestionCount: 1,
  examDurationMinutes: 60,
  passScore: 60,
  primaryType: 'single',
  disclaimer: 'AI 辅助解析，仅供复习参考',
}

const question: Question = {
  id: '1',
  type: 'single',
  stem: '示例题干',
  options: [
    { key: 'A', text: '正确' },
    { key: 'B', text: '错误' },
  ],
  answer: ['A'],
  answerText: '正确',
  explanation: '示例解析',
  explanationSource: 'ai',
  searchTerms: [],
  revision: 1,
}

describe('validateBank', () => {
  test('accepts a valid bank', () => {
    expect(validateBank(config, [question])).toEqual([])
  })

  test('reports an answer that is not an option', () => {
    const invalid = { ...question, answer: ['C'] }
    expect(validateBank(config, [invalid])).toContain('第 1 题答案不存在于选项中')
  })
})

