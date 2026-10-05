import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import StudyPage from './StudyPage'
import { QUESTIONS } from '@/config/bank'

const mocks = vi.hoisted(() => ({
  getProgress: vi.fn(),
  getWrongRecords: vi.fn(),
  getStudyPosition: vi.fn(),
  saveProgress: vi.fn(),
  saveWrongRecord: vi.fn(),
  deleteWrongRecord: vi.fn(),
  saveStudyPosition: vi.fn(),
}))

vi.mock('@/hooks/useRepository', () => ({
  useRepository: () => mocks,
}))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      schemaVersion: 1,
      fontSize: 'medium',
      wrongRemovalRule: 'threeTimes',
      explanationExpanded: true,
      autoNextAfterCorrect: false,
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getProgress.mockResolvedValue(new Map())
  mocks.getWrongRecords.mockResolvedValue(new Map())
  mocks.getStudyPosition.mockResolvedValue(undefined)
  mocks.saveProgress.mockResolvedValue(undefined)
  mocks.saveWrongRecord.mockResolvedValue(undefined)
  mocks.deleteWrongRecord.mockResolvedValue(undefined)
  mocks.saveStudyPosition.mockResolvedValue(undefined)
})

function renderStudyPage() {
  return render(
    <MemoryRouter initialEntries={['/study?mode=back']}>
      <Routes>
        <Route path="/study" element={<StudyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('loads saved state once instead of rebuilding the queue repeatedly', async () => {
  renderStudyPage()

  await waitFor(() => expect(mocks.getStudyPosition).toHaveBeenCalledTimes(1))
  await new Promise((resolve) => window.setTimeout(resolve, 80))

  expect(mocks.getStudyPosition).toHaveBeenCalledTimes(1)
  expect(mocks.getWrongRecords).toHaveBeenCalledTimes(1)
})

test('advances to the next question without snapping back', async () => {
  const user = userEvent.setup()
  renderStudyPage()

  await screen.findByText(QUESTIONS[0].stem)
  await user.click(screen.getByRole('button', { name: /下一题/ }))
  await screen.findByText(QUESTIONS[1].stem)

  await new Promise((resolve) => window.setTimeout(resolve, 80))
  expect(screen.getByText(QUESTIONS[1].stem)).toBeInTheDocument()
  expect(screen.queryByText(QUESTIONS[0].stem)).not.toBeInTheDocument()
})
