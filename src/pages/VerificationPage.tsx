import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { CheckCircle, ShieldCheck, MapPin, Coffee, Truck, ExternalLink, Globe, Lock, QrCode } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'
import BatchQr, { BatchQrDownloadButton } from '../components/BatchQr'
import contractInfo from '../contracts/contractInfo.json'

const VerificationPage: React.FC = () => {
  const [batchData, setBatchData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ipfsPrice, setIpfsPrice] = useState<number | null>(null)
  useTheme()

  // Debug: Log env vars on page load
  useEffect(() => {
    console.log('=== VerificationPage Debug Info ===')
    console.log('VITE_RPC_URL:', import.meta.env.VITE_RPC_URL || 'NOT SET (will use fallback)')
    console.log('VITE_PINATA_GATEWAY:', import.meta.env.VITE_PINATA_GATEWAY || 'NOT SET (will use fallback)')
    console.log('====================================')
  }, [])

  const queryParams = new URLSearchParams(window.location.search)
  const batchId = queryParams.get('batch')

  useEffect(() => {
    const fetchBatchData = async () => {
      if (!batchId) {
        setError('No Batch ID provided in URL.')
        setLoading(false)
        return
      }

      try {
        const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/9o0gqlT4uJtxqzqgULxPY' || 'https://sepolia.drpc.org'
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, provider)
        
        const batch = await contract.getBatch(batchId)
        
        if (!batch.isRegistered) {
          setError(`Batch ${batchId} not found on blockchain.`)
        } else {
          // Prefer the on-chain price written on the new contract.
          const onChainPrice = Number(batch.soldPricePerKgRWF?.toString?.() ?? batch.pricePerKgRWF?.toString?.() ?? 0)
          if (!Number.isNaN(onChainPrice) && onChainPrice > 0) {
            setIpfsPrice(onChainPrice)
          }

          // Keep CID discovery as a non-blocking fallback for older batches.
          void (async () => {
            try {
              const rpcProvider = provider
              const windowSize = 10
              const lookback = 300
              const latestBlock = await rpcProvider.getBlockNumber()
              const startBlock = Math.max(0, latestBlock - lookback)
              let latestAttachedCid: string | undefined
              let latestTs = 0
              const filter = contract.filters.DocumentAttached()
              for (let to = latestBlock; to >= startBlock; to -= windowSize) {
                const from = Math.max(startBlock, to - windowSize + 1)
                try {
                  const events = await contract.queryFilter(filter, from, to)
                  for (const ev of events) {
                    try {
                      const evLog = ev as any
                      const args = evLog.args
                      if (Array.isArray(args) && args.length >= 3) {
                        const evBatchId = String(args[0])
                        const cid = String(args[1])
                        const ts = Number(args[2]?.toString?.() ?? 0)
                        if (String(evBatchId) === String(batchId) && cid && ts > latestTs) {
                          latestAttachedCid = cid
                          latestTs = ts
                        }
                      }
                    } catch {
                      // ignore single event parse error
                    }
                  }
                  if (latestAttachedCid) break
                } catch (err) {
                  console.warn('Windowed query failed for blocks', from, '->', to, err)
                }
              }

              if (latestAttachedCid && String(latestAttachedCid) !== String(batch.ipfsHash)) {
                batch.ipfsPriceCid = latestAttachedCid
                console.log('Found attached price CID from events (windowed):', latestAttachedCid)
              }

              if (!batch.ipfsPriceCid) {
                try {
                  const key = `coffeeTrace.batches.${contractInfo.address}`
                  const raw = window.localStorage.getItem(key)
                  if (raw) {
                    const parsed = JSON.parse(raw) as any[]
                    const found = parsed.find((b: any) => String(b.batchId) === String(batchId))
                    if (found?.export?.ipfsPriceCid) {
                      batch.ipfsPriceCid = found.export.ipfsPriceCid
                      console.log('Found price CID from localStorage:', found.export.ipfsPriceCid)
                    }
                  }
                } catch (e) {
                  console.warn('Failed to read localStorage fallback:', e)
                }
              }
            } catch (e) {
              console.warn('Non-blocking price CID lookup failed:', e)
            }
          })()
          
          setBatchData(batch)
          if (onChainPrice <= 0) {
            const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'ipfs.io'
            const tryFetchPrice = async (cid: string | undefined) => {
              if (!cid) return null
              try {
                const res = await fetch(`https://${gateway}/ipfs/${cid}`, { signal: AbortSignal.timeout(5000) })
                if (!res.ok) return null
                const json = await res.json()
                const p = json?.sellingPrice ?? json?.price
                if (p !== undefined && p !== null && String(p).trim() !== '') {
                  const n = Number(p)
                  if (!Number.isNaN(n)) return n
                }
              } catch (err) {
                console.warn(`Failed to fetch price from IPFS (${cid}):`, err)
              }
              return null
            }

            const priceCid = batch.ipfsPriceCid ?? batch?.export?.ipfsPriceCid
            let n = await tryFetchPrice(priceCid)
            if (n === null) {
              n = await tryFetchPrice(batch.ipfsHash)
            }
            if (n === null && savedPrice !== null) {
              n = savedPrice
            }
            setIpfsPrice(n)
          }
        }
      } catch (err: any) {
        console.error('Fetch Error:', err)
        setError('Could not connect to the blockchain. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchBatchData()
  }, [batchId])

  let savedPrice: number | null = null
  try {
    const key = `coffeeTrace.batches.${contractInfo.address}`
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as any[]
      const found = parsed.find(b => String(b.batchId) === String(batchId))
      const price = found?.export?.sellingPrice ?? found?.export?.price
      if (price !== undefined && price !== null && String(price).trim() !== '') {
        const num = Number(price)
        if (!Number.isNaN(num)) savedPrice = num
      }
    }
  } catch (e) {}

  useEffect(() => {
    if (!batchData) return

    const onChainPrice = Number(batchData.soldPricePerKgRWF?.toString?.() ?? batchData.pricePerKgRWF?.toString?.() ?? batchData.onChainPricePerKgRWF ?? 0)
    if (!Number.isNaN(onChainPrice) && onChainPrice > 0) {
      setIpfsPrice(onChainPrice)
      return
    }

    // Older batches may still rely on an IPFS price document.
    const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'ipfs.io'

    const tryFetchPrice = async (cid: string | undefined) => {
      if (!cid) return null
      try {
        const res = await fetch(`https://${gateway}/ipfs/${cid}`, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) return null
        const json = await res.json()
        const p = json?.sellingPrice ?? json?.price
        if (p !== undefined && p !== null && String(p).trim() !== '') {
          const n = Number(p)
          if (!Number.isNaN(n)) return n
        }
      } catch (err) {
        console.warn(`Failed to fetch price from IPFS (${cid}):`, err)
      }
      return null
    }

    ;(async () => {
      const priceCid = batchData.ipfsPriceCid ?? batchData?.export?.ipfsPriceCid
      let n = await tryFetchPrice(priceCid)
      if (n === null) {
        n = await tryFetchPrice(batchData.ipfsHash)
      }
      if (n === null && savedPrice !== null) {
        n = savedPrice
      }
      setIpfsPrice(n)
    })()
  }, [batchData])

  if (loading) {
    return (
      <div className="min-h-screen theme-bg-primary flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/20 dark:border-[#00f2fe]/20 border-t-emerald-500 dark:border-t-[#00f2fe] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="muted font-medium">Verifying on blockchain...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen theme-bg-primary flex items-center justify-center p-6 transition-colors">
        <div className="card border-red-500/30 p-8 rounded-3xl max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-red-600 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold theme-text mb-2">Verification Failed</h2>
          <p className="muted mb-6">{error}</p>

        </div>
      </div>
    )
  }

  const qrValue = window.location.href

  return (
    <div className="min-h-screen theme-bg-primary theme-text p-4 md:p-8 selection:bg-emerald-500/30 dark:selection:bg-[#00f2fe]/30 transition-colors relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-40 h-80 w-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl opacity-60 dark:opacity-100" />
        <div className="absolute -right-40 top-32 h-96 w-96 rounded-full bg-sky-500/5 dark:bg-sky-500/10 blur-3xl opacity-60 dark:opacity-100" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-[#00f2fe] mb-2">
              <ShieldCheck size={20} />
              <span className="text-sm font-bold tracking-widest uppercase">Verified Supply Chain</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight theme-text">Traceability Certificate</h1>
            <p className="muted mt-2">Immutable record for batch <span className="font-mono font-bold theme-text">{batchId}</span></p>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a 
              href={`https://sepolia.etherscan.io/address/${contractInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn px-5 py-2.5 shadow-sm whitespace-nowrap shrink-0 text-sm"
            >
              <ExternalLink size={14} />
              View Contract
            </a>
            <a
              href="/gallery"
              className="gallery-cta group px-5 py-2.5 whitespace-nowrap shrink-0 text-sm"
            >
              <Coffee size={14} className="gallery-cta-icon" />
              <span>Explore Gallery</span>
              <span className="gallery-cta-chip">Open now</span>
            </a>
            {/* <button 
              onClick={() => window.location.href = '/'}
              className="btn btn-emerald px-6 py-2.5 shadow-lg"
            >
              <ArrowLeft size={14} />
              Dashboard
            </button> */}
          </div>
        </div>

        {/* Main Certificate Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Key Stats */}
          <div className="lg:col-span-2 space-y-8">
            <div className="card p-8 md:p-10 relative overflow-hidden group shadow-sm transition-all rounded-[2.5rem]">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-5 group-hover:opacity-[0.05] dark:group-hover:opacity-10 transition-opacity">
                <Globe size={180} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div>
                    <label className="label mb-2 block uppercase tracking-[0.2em]">Producer / Farmer</label>
                    <p className="text-2xl font-bold theme-text">{batchData.farmer}</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-[#00f2fe] mt-1">{batchData.cooperative}</p>
                  </div>
                  <div>
                    <label className="label mb-2 block uppercase tracking-[0.2em]">Origin Details</label>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin size={18} className="muted" />
                      <p className="text-2xl font-bold theme-text">{batchData.origin}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="label mb-2 block uppercase tracking-[0.2em]">Harvest Date</label>
                    <p className="text-2xl font-bold theme-text">{batchData.collectionDate}</p>
                  </div>
                  <div>
                    <label className="label mb-2 block uppercase tracking-[0.2em]">Total Weight</label>
                    <p className="text-2xl font-bold theme-text">{batchData.weight} <span className="text-sm muted">KG</span></p>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t theme-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-4 text-emerald-700 dark:text-green-400">
                  <div className="w-12 h-12 bg-emerald-500/10 dark:bg-green-500/10 rounded-2xl flex items-center justify-center">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <p className="text-base font-bold">Registration Verified</p>
                    <p className="text-xs opacity-60">Immutable Blockchain Record</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality & Processing Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="card p-8 shadow-sm rounded-4xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-emerald-500/15 dark:bg-[#00f2fe]/10 rounded-xl flex items-center justify-center">
                    <Coffee size={20} className="text-emerald-700 dark:text-[#00f2fe]" />
                  </div>
                  <h3 className="font-bold text-lg theme-text">Quality Profile</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b theme-border-subtle">
                    <span className="muted text-sm font-medium">Grade</span>
                    <span className="font-bold theme-text">{batchData.grade || 'Pending'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b theme-border-subtle">
                    <span className="muted text-sm font-medium">Cupping Score</span>
                    <span className="text-emerald-700 dark:text-[#00f2fe] font-extrabold text-2xl">{batchData.cuppingScore || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="muted text-sm font-medium">Method</span>
                    <span className="font-bold theme-text">{batchData.washMethod || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="card p-8 shadow-sm rounded-4xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-sky-500/15 dark:bg-[#00f2fe]/10 rounded-xl flex items-center justify-center">
                    <Truck size={20} className="text-sky-700 dark:text-[#00f2fe]" />
                  </div>
                  <h3 className="font-bold text-lg theme-text">Logistics</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b theme-border-subtle">
                    <span className="muted text-sm font-medium">Buyer</span>
                    <span className="font-bold theme-text">{batchData.buyer || 'Available'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b theme-border-subtle">
                    <span className="muted text-sm font-medium">Container ID</span>
                    <span className="font-bold theme-text">{batchData.container || 'Pending'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="muted text-sm font-medium">Destination</span>
                    <span className="font-bold text-right theme-text">{batchData.destination || 'Pending'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Documentation & Trust */}
          <div className="space-y-8">
            <div className="card p-8 shadow-sm rounded-4xl flex flex-col items-center">
              <h3 className="font-bold text-lg mb-6 theme-text self-start flex items-center gap-2">
                <QrCode size={20} className="muted" />
                Certificate QR
              </h3>
              <div className="p-4 bg-white dark:bg-white rounded-2xl shadow-inner border theme-border-subtle">
                <BatchQr value={qrValue} size={160} fgColor="#020617" bgColor="#ffffff" />
              </div>
              <div className="mt-4 w-full">
                <BatchQrDownloadButton value={qrValue} batchId={batchId || 'verification'} />
              </div>
              {((ipfsPrice !== null) || (savedPrice !== null)) && (
                <div className="mt-4 w-full text-center">
                  <div className="text-sm muted">Selling price</div>
                  {(() => {
                    const display = ipfsPrice !== null ? ipfsPrice : savedPrice as number
                    const formatter = new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 })
                    return (
                      <>
                        <div className="mt-1 font-bold theme-text">{formatter.format(display)} / kg</div>
                        {batchData?.weight && !Number.isNaN(Number(batchData.weight)) && (
                          <div className="mt-2 text-sm">
                            Total: <span className="font-bold">{formatter.format(display * Number(batchData.weight))}</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
              <p className="muted text-[10px] mt-6 text-center font-bold uppercase tracking-widest">Scan to share certificate</p>
            </div>

            {batchData.ipfsHash && (
              <div className="card-ghost border border-emerald-500/30 dark:border-[#00f2fe]/20 rounded-4xl p-8 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 theme-text">
                  <ExternalLink size={20} className="text-emerald-700 dark:text-[#00f2fe]" />
                  Proof of Origin
                </h3>
                <p className="text-sm muted mb-8 leading-relaxed">A secure digital document (Invoice or Certificate) is cryptographically anchored to this batch on IPFS.</p>
                <a 
                  href={`https://${import.meta.env.VITE_PINATA_GATEWAY || 'ipfs.io'}/ipfs/${batchData.ipfsHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-emerald block w-full py-4 text-center shadow-md active:scale-[0.98]"
                >
                  Download Proof
                </a>
              </div>
            )}

            <div className="card p-8 shadow-sm rounded-4xl">
              <h3 className="font-bold text-lg mb-6 theme-text">Verification Context</h3>
              <div className="space-y-5">
                <div className="flex gap-4">
                  <div className="w-1 bg-emerald-500 dark:bg-[#00f2fe] rounded-full shrink-0"></div>
                  <p className="text-sm muted">Data is fetched in real-time from the blockchain ledger.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-1 bg-emerald-500 dark:bg-[#00f2fe] rounded-full shrink-0"></div>
                  <p className="text-sm muted">Smart Contract: <span className="font-mono text-xs break-all opacity-80">{contractInfo.address}</span></p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-20 pt-10 border-t theme-border-subtle text-center">
          <p className="muted text-xs font-medium uppercase tracking-widest">© 2026 CoffeeTrace Supply Chain Network • Powered by Ethereum</p>
        </div>
      </div>
    </div>
  )
}

export default VerificationPage