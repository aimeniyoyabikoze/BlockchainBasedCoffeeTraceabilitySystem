import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  DatabaseZap,
  Droplets,
  FolderSync,
  Leaf,
  Lock,
  PackageSearch,
  Plane,
  ShieldCheck,
  Tractor,
  Truck,
  Coffee,
  CheckCircle,
  X,
  LayoutDashboard,
  ScanBarcode,
  UploadCloud,
} from 'lucide-react'
import BatchQr, { BatchQrDownloadButton } from './components/BatchQr'
import ThemeToggle from './components/ThemeToggle'
import {
  initialActivity,
  initialBatchId,
  initialExport,
  initialIntake,
  initialProcessing,
  type ActivityItem,
} from './features/dashboard/dashboardData'
import { useWeb3 } from './hooks/useWeb3'
import { syncFromChain } from './services/onchainSync'
import { ethers } from 'ethers'
import { useTheme } from './context/ThemeContext'
import VerificationPage from './pages/VerificationPage'
import Gallery from './pages/Gallery'
import AdminGallery from './components/AdminGallery'
import AdminImageUpload from './components/AdminImageUpload'
import { uploadToIPFS } from './services/ipfsService'
import contractInfo from './contracts/contractInfo.json'

type ModalKind = 'intake' | 'processing' | 'export' | null

function App() {
  const [activeModal, setActiveModal] = useState<ModalKind>(null)
  const [view, setView] = useState<'dashboard' | 'history' | 'gallery' | 'adminGallery'>('dashboard')
  const [adminUploadOpen, setAdminUploadOpen] = useState(false)
  const [batchId, setBatchId] = useState(initialBatchId)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [toast, setToast] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity)
  const [intakeForm, setIntakeForm] = useState(initialIntake)
  const [processingForm, setProcessingForm] = useState(initialProcessing)

  // Debug: Log env vars on app load
  useEffect(() => {
    console.log('=== Coffee Trace Debug Info ===')
    console.log('VITE_RPC_URL:', import.meta.env.VITE_RPC_URL || 'NOT SET (will use fallback)')
    console.log('VITE_PINATA_GATEWAY:', import.meta.env.VITE_PINATA_GATEWAY || 'NOT SET (will use fallback)')
    console.log('VITE_PUBLIC_APP_URL:', import.meta.env.VITE_PUBLIC_APP_URL || 'NOT SET')
    console.log('================================')
  }, [])
  const [exportForm, setExportForm] = useState(initialExport)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [txPending, setTxPending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const WASH_METHOD_OPTIONS = [
    'Washed',
    'Natural',
    'Honey',
    'Semi-washed',
    'Anaerobic',
    'Experimental'
  ]

  const GRADE_OPTIONS = [
    'AAA',
    'AA',
    'A',
    'B',
    'C',
    'Specialty'
  ]

  const { contract, roles, connectWallet, disconnectWallet, account, error: web3Error, desiredChainId, isOnDesiredNetwork, switchNetwork } = useWeb3()
  const [hideWeb3Error, setHideWeb3Error] = useState(false)

  useEffect(() => {
    // reset dismissed state when a new error occurs
    setHideWeb3Error(false)
  }, [web3Error])
  useTheme()

  const currencyFormatter = new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  })

  const parseAmount = (value: string | number | undefined | null) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const calculateTotal = (weightKg: string | number | undefined | null, pricePerKg: string | number | undefined | null) => {
    const weightValue = parseAmount(weightKg)
    const priceValue = parseAmount(pricePerKg)
    if (!weightValue || !priceValue) return 0
    return Math.round(weightValue * priceValue)
  }

  const BATCHES_KEY = `coffeeTrace.batches.${contractInfo.address}`

  const [autoSync, setAutoSync] = useState(() => {
    try {
      const stored = window.localStorage.getItem('coffeeTrace.autoSync')
      // default to enabled for first-time/new-browser users so on-chain data appears automatically
      return stored === null ? true : stored === 'true'
    } catch (e) {
      return true
    }
  })
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)

  // schedule debounced sync to avoid hammering RPC on multiple events
  useEffect(() => {
    let provider: any
    let contractForEvents: any
    let syncTimer: any

    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(async () => {
        try {
          const synced = await syncFromChain()
          if (synced && synced.length > 0) {
            saveBatches(synced)
            setLastSyncTime(Date.now())
            setActivity((prev) => [{ title: 'Auto Sync', detail: `Synced ${synced.length} batches from chain.`, time: 'Just now', tone: 'emerald' }, ...prev])
            setToast(`Auto-synced ${synced.length} batches`)
            if (synced[0]?.batchId) setBatchId(synced[0].batchId)
          }
        } catch (e: any) {
          setToast(`Auto-sync failed: ${e?.message || e}`)
        }
      }, 1000)
    }

    // Don't auto-sync if auto-sync is disabled or wallet is not connected
    if (!autoSync || !account) return () => {}

    const rpc = (import.meta.env.VITE_RPC_URL as string) || ''
    if (!rpc) {
      setToast('VITE_RPC_URL not configured for auto-sync')
      return () => {}
    }

    provider = new ethers.JsonRpcProvider(rpc)
    contractForEvents = new ethers.Contract(contractInfo.address, contractInfo.abi, provider)

    const onEvent = () => { scheduleSync() }

    // subscribe to important events
    contractForEvents.on('BatchRegistered', onEvent)
    contractForEvents.on('ProcessingLogged', onEvent)
    contractForEvents.on('ExportLogged', onEvent)
    contractForEvents.on('DocumentAttached', onEvent)

    return () => {
      try {
        contractForEvents.off('BatchRegistered', onEvent)
        contractForEvents.off('ProcessingLogged', onEvent)
        contractForEvents.off('ExportLogged', onEvent)
        contractForEvents.off('DocumentAttached', onEvent)
      } catch (e) {}
      if (syncTimer) clearTimeout(syncTimer)
    }
  }, [autoSync, account])

  const toggleAutoSync = (next?: boolean) => {
    const val = typeof next === 'boolean' ? next : !autoSync
    try { window.localStorage.setItem('coffeeTrace.autoSync', val ? 'true' : 'false') } catch (e) {}
    setAutoSync(val)
    if (val) setToast('Auto-sync enabled')
    else setToast('Auto-sync disabled')
  }

  // one-time initial sync for new browsers/devices after wallet/network is valid
  useEffect(() => {
    let cancelled = false
    const runInitialSync = async () => {
      if (!account || !isOnDesiredNetwork) return
      try {
        const existing = loadBatches()
        if (existing.length > 0) return
        const synced = await syncFromChain()
        if (cancelled || !synced || synced.length === 0) return
        saveBatches(synced)
        const first = synced[0]
        if (first?.batchId) {
          setBatchId(first.batchId)
          setProcessingForm(() => ({ ...initialProcessing, ...(first.processing || {}), batchId: first.batchId }))
          setExportForm(() => ({ ...initialExport, ...(first.export || {}), batchId: first.batchId }))
        }
        setActivity((prev) => [{ title: 'Initial Sync', detail: `Loaded ${synced.length} batches from chain.`, time: 'Just now', tone: 'emerald' }, ...prev])
        setToast(`Loaded ${synced.length} on-chain batches`)
      } catch (e: any) {
        setToast(`Initial sync failed: ${e?.message || e}`)
      }
    }
    runInitialSync()
    return () => { cancelled = true }
  }, [account, isOnDesiredNetwork])

  

  const loadBatches = () => {
    try {
      const raw = window.localStorage.getItem(BATCHES_KEY)
      if (!raw) return [] as any[]
      const parsed = JSON.parse(raw) as any[]
      return Array.from(new Map(parsed.map(b => [b.batchId, b])).values())
    } catch (err) {
      return [] as any[]
    }
  }

  const saveBatches = (batches: any[]) => {
    try {
      const unique = Array.from(new Map(batches.map(b => [b.batchId, b])).values())
      window.localStorage.setItem(BATCHES_KEY, JSON.stringify(unique))
    } catch (err) {
      // ignore
    }
  }

  const getBatchStatus = (b: any) => {
    if (b.export?.buyer) return 'Shipped'
    if (b.processing?.station) return 'Quality Verified'
    if (b.intake?.farmer) return 'Registered'
    return 'Awaiting Intake'
  }

  const closeModalWithoutSaving = () => {
    const saved = loadBatches().find((b) => b.batchId === batchId)
    if (saved) {
      if (saved.intake) setIntakeForm((cur) => ({ ...cur, ...saved.intake }))
      setProcessingForm(() => ({ ...initialProcessing, ...(saved.processing || {}), batchId: saved.batchId }))
      setExportForm(() => ({ ...initialExport, ...(saved.export || {}), batchId: saved.batchId }))
    } else {
      setIntakeForm(initialIntake)
      setProcessingForm({ ...initialProcessing, batchId })
      setExportForm({ ...initialExport, batchId })
    }
    setFormErrors({})
    setToast('Unsaved changes discarded')
    setActiveModal(null)
  }

  useEffect(() => {
    const batches = loadBatches()
    if (batches && batches.length > 0) {
      try {
        const selectedKey = `${BATCHES_KEY}.selected`
        const sel = window.localStorage.getItem(selectedKey)
        const found = sel ? batches.find(b => b.batchId === sel) : null
        const last = found || batches[0]
        if (last?.batchId) setBatchId(last.batchId)
        if (last?.intake) setIntakeForm((cur) => ({ ...cur, ...last.intake }))
        // enforce the on-chain batchId into downstream forms so refreshes don't revert to initial placeholder
        setProcessingForm(() => ({ ...initialProcessing, ...(last?.processing || {}), batchId: last?.batchId }))
        setExportForm(() => ({ ...initialExport, ...(last?.export || {}), batchId: last?.batchId }))
      } catch (e) {
        const last = batches[0]
        if (last?.batchId) setBatchId(last.batchId)
        if (last?.intake) setIntakeForm((cur) => ({ ...cur, ...last.intake }))
        if (last?.processing) setProcessingForm((cur) => ({ ...cur, ...last.processing }))
        if (last?.export) setExportForm((cur) => ({ ...cur, ...last.export }))
      }
    }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const updateFormField = <T extends Record<string, string>>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = event.target
      setter((current) => ({ ...current, [name]: value }))
      if (formErrors[name]) {
        setFormErrors((prev) => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const validateForm = (form: Record<string, string>, requiredFields: string[]) => {
    const errors: Record<string, string> = {}
    requiredFields.forEach((field) => {
      if (!form[field] || String(form[field]).trim() === '') errors[field] = 'Required'
    })
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleIntakeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateForm(intakeForm, ['farmer', 'cooperative', 'origin', 'collectionDate', 'weight', 'boughtPricePerKg'])) {
      setToast('Please fill in all required fields.')
      return
    }
    if (!contract) return

    const boughtPricePerKg = parseAmount(intakeForm.boughtPricePerKg)
    const boughtTotal = calculateTotal(intakeForm.weight, boughtPricePerKg)

    if (boughtPricePerKg <= 0 || boughtTotal <= 0) {
      setToast('Please enter a valid bought price per kg.')
      return
    }

    try {
      setTxPending(true)
      let ipfsHash = ""
      if (selectedFile) {
        setToast("Uploading document to IPFS...")
        ipfsHash = await uploadToIPFS(selectedFile)
      }

      const tx = await contract.registerBatch(
        intakeForm.farmer,
        intakeForm.cooperative,
        intakeForm.origin,
        intakeForm.collectionDate,
        intakeForm.weight,
        boughtPricePerKg,
        boughtTotal
      )
      const receipt = await tx.wait()

      const log = receipt.logs.find((l: any) => {
        try { return contract.interface.parseLog(l)?.name === 'BatchRegistered' } catch (e) { return false }
      })
      const generatedId = contract.interface.parseLog(log!)?.args[0]
      const generatedIdStr = generatedId?.toString?.() ?? generatedId

      if (ipfsHash && generatedId) {
        try { const docTx = await contract.attachDocument(generatedId, ipfsHash); await docTx.wait(); } catch (e) {}
      }

      // ensure UI state uses the on-chain generated id (string)
      setBatchId(generatedIdStr)
      setProcessingForm({ ...initialProcessing, batchId: generatedIdStr })
      setExportForm({ ...initialExport, batchId: generatedIdStr })

      const newBatch = {
        batchId: generatedIdStr,
        intake: { ...intakeForm, boughtPricePerKg: intakeForm.boughtPricePerKg, boughtPricePerKgRWF: boughtPricePerKg, boughtTotalRWF: boughtTotal, ipfsHash },
        processing: { ...initialProcessing, batchId: generatedIdStr },
        export: { ...initialExport, batchId: generatedIdStr },
        createdAt: new Date().toISOString(),
        txHash: receipt.hash,
        ipfsHash: ipfsHash,
        lastUpdated: Date.now()
      }
      saveBatches([newBatch, ...loadBatches()])
      setActivity((prev) => [{ title: 'Batch Registered', detail: `Lot ${generatedId} anchored.`, time: 'Just now', tone: 'emerald' }, ...prev])
      setToast(`Batch registered: ${generatedId}`)
      setActiveModal(null)
      setSelectedFile(null)
    } catch (err: any) {
      setToast(`Error: ${err.reason || err.message}`)
    } finally {
      setTxPending(false)
    }
  }

  const handleProcessingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateForm(processingForm, ['station', 'washMethod', 'moisture', 'grade'])) {
      setToast('Please fill in all required fields.')
      return
    }
    if (!contract) return

    try {
      setTxPending(true)
      const tx = await contract.logProcessing(processingForm.batchId, processingForm.station, processingForm.washMethod, processingForm.moisture, processingForm.grade, processingForm.cuppingScore || 0)
      const receipt = await tx.wait()
      saveBatches(loadBatches().map(b => b.batchId === processingForm.batchId ? { ...b, processing: { ...processingForm }, updateTx: receipt.hash } : b))
      setActivity((prev) => [{ title: 'Quality Updated', detail: `Batch ${processingForm.batchId} verified.`, time: 'Just now', tone: 'sky' }, ...prev])
      setToast(`Quality log updated!`)
      setActiveModal(null)
    } catch (err: any) {
      setToast(`Error: ${err.reason || err.message}`)
    } finally {
      setTxPending(false)
    }
  }

  const handleExportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateForm(exportForm, ['buyer', 'destination', 'shipDate', 'container', 'sellingPrice'])) {
      setToast('Please fill in all required fields.')
      return
    }
    if (!contract) return

    const soldPricePerKg = parseAmount(exportForm.sellingPrice)
    const batches = loadBatches()
    const existing = batches.find(b => b.batchId === exportForm.batchId)
    const soldTotal = calculateTotal(existing?.intake?.weight || '', soldPricePerKg)

    if (soldPricePerKg <= 0 || soldTotal <= 0) {
      setToast('Please enter a valid sold price per kg.')
      return
    }

    try {
      setTxPending(true)
      // If the contract supports writing price in the same tx, prefer that
      let tx
      if (typeof contract.logExportWithPrice === 'function' && exportForm.sellingPrice) {
        tx = await contract.logExportWithPrice(exportForm.batchId, exportForm.buyer, exportForm.destination, exportForm.shipDate, exportForm.container, soldPricePerKg, soldTotal)
      } else {
        tx = await contract.logExport(exportForm.batchId, exportForm.buyer, exportForm.destination, exportForm.shipDate, exportForm.container)
      }
      const receipt = await tx.wait()

      // upload selling price JSON to IPFS and attach to the batch (best-effort)
      let attachedCid: string | undefined
      try {
        if (exportForm.sellingPrice && String(exportForm.sellingPrice).trim() !== '') {
          const weight = existing?.intake?.weight || ''
          const payload = {
            batchId: exportForm.batchId,
            soldPricePerKgRWF: soldPricePerKg,
            soldTotalRWF: soldTotal,
            currency: 'RWF',
            weight: weight,
            buyer: exportForm.buyer,
            shipDate: exportForm.shipDate,
            timestamp: new Date().toISOString()
          }
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
          const file = new File([blob], `price-${exportForm.batchId}.json`, { type: 'application/json' })
          const cid = await uploadToIPFS(file)
          attachedCid = cid
          try { await contract.attachDocument(exportForm.batchId, cid) } catch (e) { /* best-effort attach */ }
        }
      } catch (e) {
        console.error('Price IPFS upload failed', e)
      }

      saveBatches(loadBatches().map(b => b.batchId === exportForm.batchId ? { ...b, export: { ...exportForm, soldPricePerKgRWF: soldPricePerKg, soldTotalRWF: soldTotal, ipfsPriceCid: attachedCid }, exportTx: receipt.hash } : b))
      setActivity((prev) => [{ title: 'Batch Shipped', detail: `Export finalized for ${exportForm.batchId}.`, time: 'Just now', tone: 'amber' }, ...prev])
      setToast(`Export finalized!`)
      setActiveModal(null)
    } catch (err: any) {
      setToast(`Error: ${err.reason || err.message}`)
    } finally {
      setTxPending(false)
    }
  }

  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
  const qrValue = `${publicAppUrl}/verify?batch=${encodeURIComponent(batchId)}`

  if (window.location.pathname.startsWith('/verify')) return <VerificationPage />
  if (window.location.pathname.startsWith('/gallery')) return <Gallery />

  if (!account) {
    return (
      <div className="min-h-screen theme-bg-primary theme-text transition-colors duration-300 relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl opacity-60 dark:opacity-100" />
          <div className="absolute right-[-10rem] top-[8rem] h-96 w-96 rounded-full bg-sky-500/5 dark:bg-sky-500/10 blur-3xl opacity-60 dark:opacity-100" />
          <div className="absolute bottom-[-10rem] left-[35%] h-80 w-80 rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-3xl opacity-60 dark:opacity-100" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-8">
          <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="card overflow-hidden rounded-[2.5rem] p-8 shadow-2xl shadow-black/[0.03] dark:shadow-black/30 backdrop-blur-xl md:p-12">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-[#00f2fe]">
                <Lock size={14} /> Wallet Required
              </div>
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight theme-text sm:text-5xl lg:text-6xl">
                Connect your wallet to enter CoffeeTrace
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 muted sm:text-base">
                The dashboard stays locked until you approve a wallet connection. Once connected, you will be taken into the batch dashboard automatically. Disconnecting clears your session and returns you here.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest muted font-bold">Step 1</div>
                  <div className="mt-2 font-bold theme-text">Connect wallet</div>
                  <div className="mt-2 text-sm muted">Approve MetaMask to continue.</div>
                </div>
                <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest muted font-bold">Step 2</div>
                  <div className="mt-2 font-bold theme-text">Open dashboard</div>
                  <div className="mt-2 text-sm muted">Role-based actions unlock automatically.</div>
                </div>
                <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest muted font-bold">Step 3</div>
                  <div className="mt-2 font-bold theme-text">Disconnect anytime</div>
                  <div className="mt-2 text-sm muted">Session data is cleared and you return here.</div>
                </div>
              </div>
            </section>

            <aside className="card rounded-[2.5rem] p-8 shadow-2xl shadow-black/[0.03] dark:shadow-black/30 backdrop-blur-xl md:p-10 flex flex-col justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-[#00f2fe]/10 rounded-2xl flex items-center justify-center">
                    <Coffee className="text-[#00f2fe]" size={26} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold theme-text">CoffeeTrace</h2>
                    <p className="text-xs uppercase tracking-widest muted font-bold">Wallet Login</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-6">
                  <h3 className="text-lg font-bold theme-text">Secure entry</h3>
                  <p className="mt-2 text-sm leading-6 muted">
                    This page acts as the login gate. Nothing in the dashboard is available until you authorize your wallet connection.
                  </p>
                  {web3Error && (
                    <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-100">
                      {web3Error}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <button onClick={connectWallet} className="btn btn-emerald w-full py-4 text-base font-bold">
                  Connect Wallet
                </button>
                <div className="text-xs muted text-center px-2">
                  By connecting, you authorize access to your role-based CoffeeTrace dashboard.
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                  <ThemeToggle />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  const selectedSavedBatch = loadBatches().find((b) => b.batchId === batchId)
  const isIntakeDone = !!selectedSavedBatch?.intake?.farmer
  const isProcessingDone = !!selectedSavedBatch?.processing?.station
  const isExportDone = !!selectedSavedBatch?.export?.buyer

  return (
    <div className="min-h-screen theme-bg-primary theme-text transition-colors duration-300">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl opacity-60 dark:opacity-100" />
        <div className="absolute right-[-10rem] top-[8rem] h-96 w-96 rounded-full bg-sky-500/5 dark:bg-sky-500/10 blur-3xl opacity-60 dark:opacity-100" />
        <div className="absolute bottom-[-10rem] left-[35%] h-80 w-80 rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-3xl opacity-60 dark:opacity-100" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        {!hideWeb3Error && web3Error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(1200px,95%)]">
            <div className="card bg-amber-50 dark:bg-amber-900/80 border-amber-300 dark:border-amber-700 px-4 py-3 flex items-start justify-between">
              <div className="pr-4">
                <div className="font-bold text-amber-700 dark:text-amber-200">Connection Error</div>
                <div className="text-sm mt-1 text-amber-800 dark:text-amber-100 break-words">{web3Error}</div>
                <div className="text-xs muted mt-1">Please switch MetaMask to the target network {desiredChainId && `(${desiredChainId})`} or verify the contract address.</div>
              </div>
              <div className="flex items-start gap-2">
                {desiredChainId && !isOnDesiredNetwork && (
                  <button onClick={async () => { const ok = await switchNetwork(); if (ok) { connectWallet() } }} className="btn btn-emerald btn-sm">Switch Network</button>
                )}
                <button onClick={() => setHideWeb3Error(true)} className="btn btn-ghost btn-sm">Dismiss</button>
              </div>
            </div>
          </div>
        )}
        
        <aside className="card px-6 py-6 backdrop-blur-xl lg:w-80 lg:border-b-0 lg:border-r lg:px-5">
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-2 mb-10">
              <div className="w-10 h-10 bg-[#00f2fe]/10 rounded-xl flex items-center justify-center">
                <Coffee className="text-[#00f2fe]" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight theme-text">CoffeeTrace</h2>
                <p className="text-[10px] uppercase tracking-widest muted font-bold">Network Node</p>
              </div>
            </div>

            <div className="px-2 mb-4">
              {!account ? (
                <button onClick={connectWallet} className="btn btn-outline-accent w-full mb-3">
                  Connect Wallet
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="pill">{account.slice(0,6)}...{account.slice(-4)}</div>
                  <button onClick={disconnectWallet} className="btn w-full">Disconnect</button>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-auto">
              <p className="text-[10px] uppercase tracking-widest muted font-extrabold px-2 mb-4">Views</p>
              <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${view === 'dashboard' ? 'nav-active' : 'muted hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <LayoutDashboard size={18} />
                <span className="font-bold text-sm">Dashboard</span>
              </button>
              <button onClick={() => setView('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${view === 'history' ? 'nav-active' : 'muted hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <PackageSearch size={18} />
                <span className="font-bold text-sm">Batch Browser</span>
              </button>

              {/* <button onClick={() => setView('gallery')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${view === 'gallery' ? 'nav-active' : 'muted hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <DatabaseZap size={18} />
                <span className="font-bold text-sm">Gallery</span>
              </button> */}

              <div className="pt-6">
                <p className="text-[10px] uppercase tracking-widest muted font-extrabold px-2 mb-4">Operations</p>
                <button onClick={() => { setBatchId(initialBatchId); setIntakeForm(initialIntake); setProcessingForm(initialProcessing); setExportForm(initialExport); setView('dashboard'); setToast("Ready for new intake"); }} className="btn btn-emerald w-full flex items-center gap-3 px-4 py-3 mb-4">
                  <CheckCircle size={18} />
                  <span className="font-bold text-sm">Start New Intake</span>
                </button>
                {roles.isAdmin && (
                    <button onClick={() => setView('adminGallery')} className="btn w-full flex items-center gap-3 px-4 py-3 mb-4">
                    <DatabaseZap size={18} />
                      <span className="font-bold text-sm">Admin Gallery</span>
                  </button>
                )}
                
                <button onClick={() => toggleAutoSync()} className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl transition-all font-bold text-sm ${autoSync ? 'btn btn-primary' : 'btn-outline-accent'}`}>
                  <UploadCloud size={18} />
                  <span className="font-bold text-sm">Auto Sync: {autoSync ? 'On' : 'Off'}</span>
                </button>
                <p className="text-xs muted px-2 mt-1">Auto Sync listens for on-chain events and updates batches automatically.</p>
                {lastSyncTime && (
                  <p className="text-xs muted px-2 mt-2">Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</p>
                )}
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-white/10">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>

        <main className={`flex-1 px-5 py-5 lg:px-8 lg:py-8 overflow-y-auto ${desiredChainId && !isOnDesiredNetwork ? 'pointer-events-none opacity-60 select-none' : ''}`}>
          {view === 'dashboard' ? (
            <section className="overflow-hidden rounded-[2rem] card shadow-2xl shadow-black/[0.03] dark:shadow-black/30 backdrop-blur-xl">
              <div className="border-b border-slate-200 dark:border-white/10 px-6 py-6 lg:px-8 lg:py-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/50 dark:border-[#00f2fe]/30 bg-emerald-500/15 dark:bg-[#00f2fe]/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-[#00f2fe]">
                      <DatabaseZap size={14} /> Active Batch Management
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight theme-text sm:text-4xl lg:text-5xl">
                      Lot Traceability Dashboard
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 muted sm:text-base">
                      Record intake, update processing quality, and finalize exports for the current coffee batch.
                    </p>
                  </div>
                    <div className="pill">
                    <ShieldCheck size={14} className="text-emerald-600 dark:text-[#00f2fe]" />
                    Network Node Verified
                  </div>
                </div>

                <div className="mt-10 flex flex-wrap gap-4 pt-8 border-t border-slate-200 dark:border-white/5">
                    {roles.isIntake && (
                    <button 
                      onClick={() => setActiveModal('intake')} 
                      disabled={isIntakeDone}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${isIntakeDone ? 'btn-disabled' : 'btn btn-emerald'}`}
                    >
                      <Leaf size={18} /> {isIntakeDone ? 'Intake Registered' : 'Register Intake'}
                    </button>
                  )}
                  {roles.isProcessor && (
                    <button 
                      onClick={() => setActiveModal('processing')} 
                      disabled={!isIntakeDone || isProcessingDone}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${!isIntakeDone || isProcessingDone ? 'btn-disabled' : 'btn btn-sky'}`}
                    >
                      <Droplets size={18} /> {isProcessingDone ? 'Quality Logged' : 'Quality Log'}
                    </button>
                  )}
                  {roles.isExporter && (
                    <button 
                      onClick={() => setActiveModal('export')} 
                      disabled={!isProcessingDone || isExportDone}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${!isProcessingDone || isExportDone ? 'btn-disabled' : 'btn btn-amber'}`}
                    >
                      <Plane size={18} /> {isExportDone ? 'Export Finalized' : 'Export Prep'}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.6fr] lg:px-8 lg:py-8">
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MetricCard title="Tracking ID" value={batchId === 'CT-XXXXXX-XXX' ? '---' : batchId} detail="On-chain identity" tone="emerald" />
                    <MetricCard title="Weight" value={intakeForm.weight ? `${intakeForm.weight} kg` : '---'} detail="Recorded at intake" tone="sky" />
                    <MetricCard title="Lot Status" value={getBatchStatus({ intake: intakeForm, processing: processingForm, export: exportForm })} detail="Current pipeline phase" tone="amber" />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <section className="card p-6 shadow-sm transition-colors">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-bold muted">Batch story</p>
                          <h2 className="mt-1 text-xl font-bold theme-text">Stage-by-stage record</h2>
                        </div>
                        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Traceable</div>
                      </div>
                      <div className="space-y-4">
                        <StoryRow icon={Tractor} title="Farm intake" detail={intakeForm.farmer ? `${intakeForm.farmer} | ${intakeForm.origin}` : 'Pending registration'} accent="emerald" pending={!intakeForm.farmer} />
                        <StoryRow icon={FolderSync} title="Processing" detail={processingForm.station ? `${processingForm.washMethod} | ${processingForm.grade}` : 'Pending processing'} accent="sky" pending={!processingForm.station} />
                        <StoryRow icon={Truck} title="Export" detail={exportForm.buyer ? `${exportForm.buyer} | ${exportForm.destination}` : 'Pending shipment'} accent="amber" pending={!exportForm.buyer} />
                      </div>
                    </section>

                    <section className="card p-6 shadow-sm transition-colors">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-bold muted">Verification</p>
                          <h2 className="mt-1 text-xl font-bold theme-text">Batch QR code</h2>
                        </div>
                        <div className="rounded-full border px-3 py-1.5 text-[10px] font-bold theme-text uppercase tracking-wider">PUBLIC</div>
                      </div>
                      <div className="space-y-6">
                        <div className="flex justify-center p-4 rounded-2xl border shadow-sm card"><BatchQr value={qrValue} size={140} /></div>
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <InfoPill label="Status" value={getBatchStatus({ intake: intakeForm, processing: processingForm, export: exportForm })} />
                            <InfoPill label="Owner" value={intakeForm.cooperative || "---"} />
                          </div>
                          <BatchQrDownloadButton value={qrValue} batchId={batchId} />
                          <button onClick={() => window.open(`${publicAppUrl}/verify?batch=${encodeURIComponent(batchId)}`, '_blank')} className="btn btn-outline-accent w-full">Open public verification</button>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="space-y-6">
                  <section className="card p-6">
                    <h2 className="text-xl font-bold theme-text mb-6">Recent updates</h2>
                    <div className="space-y-3">
                      {activity.map((item, idx) => <ActivityRow key={idx} item={item} />)}
                    </div>
                  </section>
                </div>
              </div>
            </section>
          ) : view === 'history' ? (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
                <div>
                  <h1 className="text-4xl font-bold theme-text mb-2">Batch Browser</h1>
                  <p className="muted">Search and audit all coffee lots anchored on the blockchain.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative group">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 muted group-focus-within:text-emerald-500 transition-colors" size={18} />
                    <input placeholder="Search ID or Farmer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input pl-12 pr-6 w-[280px]" />
                  </div>
                    <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="input px-6 py-3 cursor-pointer">
                    <option value="all">All Stages</option>
                    <option value="Registered">Registered</option>
                    <option value="Quality Verified">Processed</option>
                    <option value="Shipped">Shipped</option>
                  </select>
                  <button onClick={async () => { const synced = await syncFromChain(); if (synced) { saveBatches(synced); setLastSyncTime(Date.now()); setToast(`Refreshed ${synced.length} batches`); } }} className="btn btn-outline-accent px-6 py-3 text-sm">Refresh From Chain</button>
                </div>
              </div>

              <div className="card rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/[0.02]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-300 dark:border-white/5">
                      <th className="px-8 py-5 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest">Tracking ID</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest">Farmer Detail</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest">Pricing</th>
                      <th className="px-8 py-5 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {loadBatches().filter(b => {
                      const matches = b.batchId.toLowerCase().includes(searchQuery.toLowerCase()) || b.intake?.farmer?.toLowerCase().includes(searchQuery.toLowerCase())
                      return matches && (filterStage === 'all' || getBatchStatus(b) === filterStage)
                    }).map((b, i) => {
                      const boughtPrice = parseAmount(b.intake?.boughtPricePerKgRWF ?? b.intake?.boughtPricePerKg)
                      const boughtTotal = parseAmount(b.intake?.boughtTotalRWF) || calculateTotal(b.intake?.weight || '', boughtPrice)
                      const soldPrice = parseAmount(b.export?.soldPricePerKgRWF ?? b.export?.sellingPrice)
                      const soldTotal = parseAmount(b.export?.soldTotalRWF) || calculateTotal(b.intake?.weight || '', soldPrice)
                      return (
                      <tr key={i} className="hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6 font-mono font-bold text-emerald-700 dark:text-[#00f2fe]">{b.batchId}</td>
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-900 dark:text-white">{b.intake?.farmer || '---'}</div>
                          <div className="text-xs text-slate-700 dark:text-slate-500 font-medium">{b.intake?.origin || '---'}</div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBatchStatus(b) === 'Shipped' ? 'bg-amber-500/10 text-amber-600' : getBatchStatus(b) === 'Quality Verified' ? 'bg-sky-500/10 text-sky-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                            {getBatchStatus(b)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-medium theme-text">
                          {boughtPrice || soldPrice ? (
                            <div className="flex flex-col gap-2 text-xs sm:text-sm">
                              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                                <p className="font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Bought</p>
                                <p className="mt-1">{boughtPrice ? `${currencyFormatter.format(boughtPrice)} / kg` : '---'}</p>
                                <p className="muted">Total: {boughtTotal ? currencyFormatter.format(boughtTotal) : '---'}</p>
                              </div>
                              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                                <p className="font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Sold</p>
                                <p className="mt-1">{soldPrice ? `${currencyFormatter.format(soldPrice)} / kg` : '---'}</p>
                                <p className="muted">Total: {soldTotal ? currencyFormatter.format(soldTotal) : '---'}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 italic">---</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={() => {
                            // ensure forms always have the on-chain batch id present
                            setBatchId(b.batchId)
                            setIntakeForm((cur) => ({ ...cur, ...(b.intake || {}) }))
                            setProcessingForm(() => ({ ...initialProcessing, ...(b.processing || {}), batchId: b.batchId }))
                            setExportForm(() => ({ ...initialExport, ...(b.export || {}), batchId: b.batchId }))
                            // persist user selection so it survives refreshes
                            try { window.localStorage.setItem(`${BATCHES_KEY}.selected`, b.batchId) } catch (e) {}
                            setView('dashboard')
                          }} className="btn btn-emerald px-5 py-2 rounded-xl text-xs">View</button>
                        </td>
                      </tr>
                      )
                    })}
                    {loadBatches().length === 0 && <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-600 dark:text-slate-400 italic">No records found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : view === 'adminGallery' ? (
            <section className="overflow-hidden rounded-[2.25rem] border border-slate-200/80 dark:border-white/10 bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl shadow-black/[0.04] backdrop-blur-xl">
              <div className="flex flex-col gap-4 border-b border-slate-200/80 dark:border-white/10 px-6 py-7 md:px-8 md:py-10 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Company Media Hub</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 muted md:text-base">
                    Upload new and manage company images.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setAdminUploadOpen(true)} className="btn btn-emerald px-5 py-3 text-sm">
                    <UploadCloud size={16} />
                    Add New Image
                  </button>
                </div>
              </div>
              <div className="min-h-[420px] max-h-[calc(100vh-14rem)] overflow-y-auto rounded-[2rem] border border-slate-200/80 dark:border-white/10 bg-[var(--bg-secondary)] p-4 sm:p-5 shadow-sm">
                <AdminGallery />
              </div>
            </section>
          ) : null}
        </main>
      </div>

      {activeModal && (
        <ModalShell onClose={closeModalWithoutSaving}>
          {activeModal === 'intake' && (
            <form onSubmit={handleIntakeSubmit} className="space-y-6">
              <ModalHeader eyebrow="Stage 1" title="Register Intake" description="Capture farm gate details." onClose={closeModalWithoutSaving} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Farmer" name="farmer" value={intakeForm.farmer} onChange={updateFormField(setIntakeForm)} required readOnly={isIntakeDone} />
                <Field label="Cooperative" name="cooperative" value={intakeForm.cooperative} onChange={updateFormField(setIntakeForm)} required readOnly={isIntakeDone} />
                <Field label="Origin" name="origin" value={intakeForm.origin} onChange={updateFormField(setIntakeForm)} required />
                <Field label="Weight (kg)" name="weight" type="number" value={intakeForm.weight} onChange={updateFormField(setIntakeForm)} required />
                <Field label="Bought Price (per kg)" name="boughtPricePerKg" type="number" value={intakeForm.boughtPricePerKg} onChange={updateFormField(setIntakeForm)} required />
                <Field label="Date" name="collectionDate" type="date" value={intakeForm.collectionDate} onChange={updateFormField(setIntakeForm)} required />
                <div className="sm:col-span-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm muted">
                  <span className="font-bold theme-text">Bought total:</span>{' '}
                  {calculateTotal(intakeForm.weight, intakeForm.boughtPricePerKg)
                    ? currencyFormatter.format(calculateTotal(intakeForm.weight, intakeForm.boughtPricePerKg))
                    : 'Enter weight and bought price to calculate the total.'}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase ml-1 tracking-wide mb-2 block">Attachment (Optional)</label>
                  <div className="relative group cursor-pointer">
                    <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="w-full bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 group-hover:border-emerald-500/50 transition-all">
                      <UploadCloud className="text-slate-400 dark:text-gray-500 group-hover:text-emerald-500" size={24} />
                      <p className="text-sm font-bold text-slate-600 dark:text-gray-300">{selectedFile ? selectedFile.name : "Click or drag to upload document"}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">PDF, JPG up to 10MB</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                <SecondaryButton label="Cancel" onClick={closeModalWithoutSaving} />
                <PrimaryButton label={txPending ? "Processing..." : "Register Batch"} disabled={txPending} />
              </div>
            </form>
          )}
          {activeModal === 'processing' && (
            <form onSubmit={handleProcessingSubmit} className="space-y-6">
              <ModalHeader eyebrow="Stage 2" title="Quality Log" description="Log processing metrics." onClose={closeModalWithoutSaving} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Batch ID" name="batchId" value={processingForm.batchId} onChange={updateFormField(setProcessingForm)} required readOnly />
                <Field label="Station" name="station" value={processingForm.station} onChange={updateFormField(setProcessingForm)} required />
                <Field label="Wash Method" name="washMethod" value={processingForm.washMethod} onChange={updateFormField(setProcessingForm)} required options={WASH_METHOD_OPTIONS} />
                <Field label="Grade" name="grade" value={processingForm.grade} onChange={updateFormField(setProcessingForm)} required options={GRADE_OPTIONS} />
                <Field label="Moisture %" name="moisture" type="number" value={processingForm.moisture} onChange={updateFormField(setProcessingForm)} required />
                <Field label="Cupping Score" name="cuppingScore" type="number" value={processingForm.cuppingScore} onChange={updateFormField(setProcessingForm)} />
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                <SecondaryButton label="Cancel" onClick={closeModalWithoutSaving} />
                <PrimaryButton label={txPending ? "Processing..." : "Update Quality"} disabled={txPending} />
              </div>
            </form>
          )}
          {activeModal === 'export' && (
            <form onSubmit={handleExportSubmit} className="space-y-6">
              <ModalHeader eyebrow="Stage 4" title="Export Prep" description="Finalize shipment details." onClose={closeModalWithoutSaving} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Buyer" name="buyer" value={exportForm.buyer} onChange={updateFormField(setExportForm)} required readOnly={isExportDone} />
                <Field label="Destination" name="destination" value={exportForm.destination} onChange={updateFormField(setExportForm)} required readOnly={isExportDone} />
                <Field label="Container" name="container" value={exportForm.container} onChange={updateFormField(setExportForm)} required readOnly={isExportDone} />
                <Field label="Date" name="shipDate" type="date" value={exportForm.shipDate} onChange={updateFormField(setExportForm)} required readOnly={isExportDone} />
                <Field label="Sold Price (per kg)" name="sellingPrice" type="number" value={exportForm.sellingPrice || ''} onChange={updateFormField(setExportForm)} required readOnly={isExportDone} />
                <div className="sm:col-span-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm muted">
                  <span className="font-bold theme-text">Sold total:</span>{' '}
                  {calculateTotal(loadBatches().find((b) => b.batchId === exportForm.batchId)?.intake?.weight || intakeForm.weight, exportForm.sellingPrice || '')
                    ? currencyFormatter.format(calculateTotal(loadBatches().find((b) => b.batchId === exportForm.batchId)?.intake?.weight || intakeForm.weight, exportForm.sellingPrice || ''))
                    : 'Enter a sold price to calculate the total.'}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                <SecondaryButton label="Cancel" onClick={closeModalWithoutSaving} />
                <PrimaryButton label={txPending ? "Finalizing..." : "Finalize Export"} disabled={txPending} />
              </div>
            </form>
          )}
        </ModalShell>
      )}

      {view === 'gallery' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/60 backdrop-blur-md">
          <div className="max-w-6xl w-full overflow-auto rounded-[2rem] border border-slate-200/80 dark:border-white/10 bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl shadow-black/20 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold muted">Public Gallery</p>
                <h3 className="text-2xl font-extrabold theme-text">Company Gallery</h3>
              </div>
              <button onClick={() => setView('dashboard')} className="btn btn-outline-accent">Close</button>
            </div>
            <Gallery />
          </div>
        </div>
      )}

      {adminUploadOpen && (
        <ModalShell onClose={() => setAdminUploadOpen(false)}>
          <div className="space-y-4">
            <ModalHeader eyebrow="Upload" title="Add New Company Image" description="Upload a new image to the gallery without leaving the page." onClose={() => setAdminUploadOpen(false)} />
            <AdminImageUpload onUploaded={() => setAdminUploadOpen(false)} />
          </div>
        </ModalShell>
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}

function MetricCard({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: 'emerald' | 'sky' | 'amber' }) {
  const t = tone === 'emerald' ? 'from-emerald-500/25 to-emerald-500/15 border-emerald-300 dark:border-white/10 text-emerald-800 dark:text-emerald-300' : tone === 'sky' ? 'from-sky-500/25 to-sky-500/15 border-sky-300 dark:border-white/10 text-sky-800 dark:text-sky-300' : 'from-amber-500/25 to-amber-500/15 border-amber-300 dark:border-white/10 text-amber-800 dark:text-amber-300'
  return (
    <div className={`rounded-[2rem] border bg-gradient-to-br ${t} p-6 shadow-sm transition-all`}>
      <p className="text-[10px] uppercase tracking-widest font-bold muted opacity-80">{title}</p>
      <p className="mt-3 text-3xl font-extrabold theme-text">{value}</p>
      <p className="mt-1 text-xs muted font-semibold opacity-90">{detail}</p>
    </div>
  )
}

function StoryRow({ icon: Icon, title, detail, accent, pending = false }: { icon: any; title: string; detail: string; accent: string; pending?: boolean }) {
  const c = accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-500/15 dark:bg-emerald-500/10' : accent === 'sky' ? 'text-sky-600 dark:text-sky-500 bg-sky-500/15 dark:bg-sky-500/10' : 'text-amber-600 dark:text-amber-500 bg-amber-500/15 dark:bg-amber-500/10'
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${pending ? 'opacity-40 grayscale-[0.5]' : ''} card`}>
      <div className={`p-3 rounded-xl ${c} shrink-0`}><Icon size={18} /></div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold theme-text">{title}</h4>
        <p className="text-xs muted font-medium truncate mt-0.5">{detail}</p>
      </div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl card">
      <p className="text-[10px] uppercase font-bold muted tracking-wider mb-1">{label}</p>
      <p className="text-sm font-bold theme-text truncate">{value}</p>
    </div>
  )
}

function ActivityRow({ item }: { item: any }) {
  const c = item.tone === 'emerald' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : item.tone === 'sky' ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
  return (
    <div className="flex gap-4 p-4 rounded-2xl card">
      <div className={`mt-2 w-2 h-2 rounded-full ${c} shrink-0`} />
      <div>
        <h4 className="text-sm font-bold theme-text">{item.title}</h4>
        <p className="text-xs muted mt-1 font-medium">{item.detail}</p>
        <span className="text-[10px] muted mt-2 block font-bold">{item.time}</span>
      </div>
    </div>
  )
}

function ModalShell({ children, onClose }: { children: any; onClose: any }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl card rounded-[2.5rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function ModalHeader({ eyebrow, title, description, onClose }: { eyebrow: string; title: string; description: string; onClose: any }) {
  return (
    <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-200 dark:border-white/10">
      <div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-500 mb-1 block">{eyebrow}</span>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
        <p className="text-sm text-slate-700 dark:text-gray-400 mt-1 font-medium">{description}</p>
      </div>
      <button onClick={onClose} className="btn p-2.5 rounded-full bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all"><X size={18} /></button>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', required = false, options, readOnly = false }: { label: string; name: string; value: string; onChange: any; type?: string; required?: boolean; options?: string[]; readOnly?: boolean }) {
  const isEmpty = !value || value.trim() === ''
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold label dark:text-slate-400 uppercase ml-1 tracking-wide">{label} {required && '*'}</label>
      {options ? (
        <select name={name} value={value} onChange={onChange} disabled={readOnly} className={`w-full input cursor-pointer ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}>
          <option value="">Select {label}</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input type={type} name={name} value={value} onChange={onChange} readOnly={readOnly} className={`w-full input ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`} />
      )}
      {required && isEmpty && <p className="text-xs text-red-500 font-medium ml-1">{label} is required</p>}
    </div>
  )
}

function PrimaryButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return <button type="submit" disabled={disabled} className={`btn btn-emerald ${disabled ? 'btn-disabled' : ''} px-10 py-4 font-bold text-sm shadow-lg transition-all active:scale-[0.98]`}>{label}</button>
}

function SecondaryButton({ label, onClick }: { label: string; onClick: any }) {
  return <button type="button" onClick={onClick} className={`btn px-10 py-4 border ${'border-slate-300 dark:border-white/5'} bg-white dark:bg-white/5 text-slate-800 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 transition-all`}>{label}</button>
}

function Toast({ message }: { message: string }) {
  return <div className="fixed bottom-10 right-10 z-[60] card px-8 py-4 rounded-2xl font-bold text-sm shadow-2xl animate-in slide-in-from-bottom-5">{message}</div>
}

export default App