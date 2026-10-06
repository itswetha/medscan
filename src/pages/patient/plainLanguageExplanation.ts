import type { ScanResult } from '../../api/scans'

const classLabels = {
  normal_probability: 'Normal',
  pneumonia_probability: 'Pneumonia',
  tuberculosis_probability: 'Tuberculosis',
  other_probability: 'Other',
} as const

export function buildPlainLanguageExplanation(result: ScanResult): string {
  const qualityMessage = result.quality.quality_score >= 70
    ? 'The image quality was good.'
    : 'The image quality was moderate, which may affect how reliable this result is.'
  const prediction = result.prediction
  let findingMessage = 'The AI model has not produced a top finding yet.'
  if (prediction) {
    const topFinding = (Object.keys(classLabels) as Array<keyof typeof classLabels>).reduce(
      (current, key) => prediction[key] > prediction[current] ? key : current,
      'normal_probability',
    )
    findingMessage = `The AI model's top finding was ${classLabels[topFinding]} with ${(prediction.ai_confidence * 100).toFixed(1)}% confidence.`
  }
  return `${qualityMessage} ${findingMessage} This is a screening result, not a diagnosis. A doctor should review it before it is treated as conclusive.`
}