export type CoffeeBatchRecord = {
  batchId: string
  farmer: string
  cooperative: string
  origin: string
  collectionDate: string
  weightKg: number
  processingStation: string
  washMethod: string
  fermentationHours: number
  dryingDays: number
  moisturePercent: number
  grade: string
  cuppingScore: number
  buyer: string
  destination: string
  shipDate: string
  container: string
  documentRef: string
}

export const sampleBatchRecord: CoffeeBatchRecord = {
  batchId: 'CT-260507-481',
  farmer: 'Mugabe Cooperative',
  cooperative: 'Dukunde Kawa Musasa',
  origin: 'Nyamasheke Highlands, Rwanda',
  collectionDate: '2026-05-07',
  weightKg: 1240,
  processingStation: 'Musasa Central Station',
  washMethod: 'Fully washed',
  fermentationHours: 16,
  dryingDays: 12,
  moisturePercent: 10.8,
  grade: 'AA',
  cuppingScore: 87.5,
  buyer: 'Nordic Roast House',
  destination: 'Rotterdam, Netherlands',
  shipDate: '2026-05-28',
  container: 'MSCU 498221-9',
  documentRef: 'PIN-7FD1-4B0C',
}