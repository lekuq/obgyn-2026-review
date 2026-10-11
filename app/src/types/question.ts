export type QuestionType = 'single' | 'multiple' | 'judge' | 'case'

export interface QuestionOption {
  key: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  stem: string
  options: QuestionOption[]
  answer: string[]
  answerText: string
  explanation: string
  explanationSource: 'provided' | 'ai' | 'edited'
  searchTerms: string[]
  revision: number
}

export interface BankConfig {
  bankId: string
  title: string
  shortName: string
  scopeLabel: string
  version: string
  buildDate: string
  questionCount: number
  examQuestionCount: number
  examDurationMinutes: number
  passScore: number
  primaryType: QuestionType
  disclaimer: string
}
