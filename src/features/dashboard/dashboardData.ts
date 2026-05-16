import { Droplets, Leaf, Plane } from 'lucide-react'

export type IntakeFormState = {
  farmer: string
  cooperative: string
  origin: string
  collectionDate: string
  weight: string
  boughtPricePerKg: string
  altitude: string
  notes: string
}

export type ProcessingFormState = {
  batchId: string
  station: string
  washMethod: string
  fermentationHours: string
  dryingDays: string
  moisture: string
  grade: string
  cuppingScore: string
  defects: string
  notes: string
}

export type ExportFormState = {
  batchId: string
  destination: string
  buyer: string
  shipDate: string
  container: string
  documentRef: string
  sellingPrice?: string
}

export type ActivityItem = {
  title: string
  detail: string
  time: string
  tone: 'emerald' | 'sky' | 'amber'
}

export const stageCards = [
  {
    id: 'stage-1',
    label: 'Farm Intake',
    title: 'Capture the lot at source',
    description: 'Register producer, origin, weight, and batch identity before the coffee leaves the farm.',
    icon: Leaf,
    accent: 'from-emerald-500/20 to-emerald-400/5',
  },
  {
    id: 'stage-2',
    label: 'Processing',
    title: 'Record washing and grading',
    description: 'Log fermentation, wash method, parchment recovery, moisture, and the final quality grade.',
    icon: Droplets,
    accent: 'from-sky-500/20 to-cyan-400/5',
  },
  {
    id: 'stage-4',
    label: 'Export',
    title: 'Attach shipping details',
    description: 'Track buyer, destination, shipping date, and the paperwork tied to the container.',
    icon: Plane,
    accent: 'from-amber-500/20 to-orange-400/5',
  },
] as const

export const initialBatchId = 'CT-XXXXXX-XXX'

export const initialIntake: IntakeFormState = {
  farmer: '',
  cooperative: '',
  origin: '',
  collectionDate: '',
  weight: '',
  boughtPricePerKg: '',
  altitude: '',
  notes: '',
}

export const initialProcessing: ProcessingFormState = {
  batchId: initialBatchId,
  station: '',
  washMethod: '',
  fermentationHours: '',
  dryingDays: '',
  moisture: '',
  grade: '',
  cuppingScore: '',
  defects: '',
  notes: '',
}

export const initialExport: ExportFormState = {
  batchId: initialBatchId,
  destination: '',
  buyer: '',
  shipDate: '',
  container: '',
  documentRef: '',
  sellingPrice: '',
}

export const initialActivity: ActivityItem[] = [
  {
    title: 'System ready',
    detail: 'The traceability network is live. Register your first batch to begin.',
    time: 'Now',
    tone: 'emerald',
  },
]