import { describe, expect, it } from 'vitest'
import { appraisalMarks, appraisalRating } from './scoring'

describe('appraisal scoring presentation', () => {
  it('calculates obtained marks from three 100-mark components', () => {
    expect(appraisalMarks(100, 80, 70)).toEqual({ total: 300, obtained: 250 })
  })

  it('applies every final rating boundary', () => {
    expect(appraisalRating(85).code).toBe('A')
    expect(appraisalRating(70).code).toBe('B')
    expect(appraisalRating(50).code).toBe('C')
    expect(appraisalRating(49.9).code).toBe('D')
  })
})
