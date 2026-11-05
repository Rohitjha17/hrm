export const APPRAISAL_FORMULA =
  'Overall = (Attendance score + Task score + Planning score) ÷ 3. Each component carries 100 marks (equal 33.33% weight). Attendance uses Full day = 1, Half day = 0.5, Quarter day = 0.25 and Absent = 0.'

export function appraisalMarks(attendance: number, task: number, planning: number) {
  return {
    total: 300,
    obtained: Math.round((Number(attendance) + Number(task) + Number(planning)) * 10) / 10,
  }
}

export function appraisalRating(score: number): { code: string; label: string } {
  if (score >= 85) return { code: 'A', label: 'Excellent' }
  if (score >= 70) return { code: 'B', label: 'Good' }
  if (score >= 50) return { code: 'C', label: 'Average' }
  return { code: 'D', label: 'Needs improvement' }
}
