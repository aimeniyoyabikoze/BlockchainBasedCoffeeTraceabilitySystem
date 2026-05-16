import contractInfo from '../contracts/contractInfo.json'
import { ethers } from 'ethers'

export async function syncFromChain(): Promise<any[]> {
  const rpc = (import.meta.env.VITE_RPC_URL as string) || 'https://eth-sepolia.g.alchemy.com/v2/9o0gqlT4uJtxqzqgULxPY' || 'https://sepolia.drpc.org'
  if (!rpc) throw new Error('VITE_RPC_URL not set')

  const provider = new ethers.JsonRpcProvider(rpc)
  const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, provider)

  // Get batch count
  const countBN: any = await contract.getBatchCount()
  const count = Number(countBN?.toString?.() ?? countBN)
  const results: any[] = []

  for (let i = 0; i < count; i++) {
    try {
      const id = await contract.batchIds(i)
      const b = await contract.getBatch(id)
      // normalize struct to plain object
      const normalized = {
        batchId: b.batchId || id,
        farmer: b.farmer || '',
        cooperative: b.cooperative || '',
        origin: b.origin || '',
        collectionDate: b.collectionDate || '',
        weight: b.weight || '',
        boughtPricePerKgRWF: Number(b.boughtPricePerKgRWF?.toString?.() ?? b.pricePerKgRWF ?? 0),
        boughtTotalRWF: Number(b.boughtTotalRWF?.toString?.() ?? 0),
        station: b.station || '',
        washMethod: b.washMethod || '',
        moisture: b.moisture || '',
        grade: b.grade || '',
        cuppingScore: b.cuppingScore || '',
        buyer: b.buyer || '',
        destination: b.destination || '',
        shipDate: b.shipDate || '',
        container: b.container || '',
        ipfsHash: b.ipfsHash || '',
        soldPricePerKgRWF: Number(b.soldPricePerKgRWF?.toString?.() ?? b.pricePerKgRWF ?? 0),
        soldTotalRWF: Number(b.soldTotalRWF?.toString?.() ?? 0),
        isRegistered: !!b.isRegistered,
        lastUpdated: Number(b.lastUpdated?.toString?.() || Date.now())
      }
      results.push({
        batchId: normalized.batchId,
        intake: {
          farmer: normalized.farmer,
          cooperative: normalized.cooperative,
          origin: normalized.origin,
          collectionDate: normalized.collectionDate,
          weight: normalized.weight,
          boughtPricePerKg: String(normalized.boughtPricePerKgRWF || ''),
          boughtPricePerKgRWF: normalized.boughtPricePerKgRWF,
          boughtTotalRWF: normalized.boughtTotalRWF || (Number(normalized.weight) && normalized.boughtPricePerKgRWF ? Math.round(Number(normalized.weight) * normalized.boughtPricePerKgRWF) : 0),
          ipfsHash: normalized.ipfsHash
        },
        processing: {
          batchId: normalized.batchId,
          station: normalized.station,
          washMethod: normalized.washMethod,
          moisture: normalized.moisture,
          grade: normalized.grade,
          cuppingScore: normalized.cuppingScore
        },
        export: {
          batchId: normalized.batchId,
          buyer: normalized.buyer,
          destination: normalized.destination,
          shipDate: normalized.shipDate,
          container: normalized.container,
          sellingPrice: normalized.soldPricePerKgRWF || undefined,
          soldPricePerKgRWF: normalized.soldPricePerKgRWF,
          soldTotalRWF: normalized.soldTotalRWF || (Number(normalized.weight) && normalized.soldPricePerKgRWF ? Math.round(Number(normalized.weight) * normalized.soldPricePerKgRWF) : 0)
        },
        createdAt: new Date(normalized.lastUpdated).toISOString(),
        txHash: null,
        ipfsHash: normalized.ipfsHash,
        ipfsPriceCid: undefined,
        lastUpdated: normalized.lastUpdated
      })
    } catch (e) {
      // continue on error for individual batch
      console.warn('Failed to fetch batch index', i, e)
    }
  }

  // persist to localStorage
  try {
    // also enrich results with any DocumentAttached events (price or other attachments)
    try {
      const docFilter = contract.filters.DocumentAttached()
      const events = await contract.queryFilter(docFilter, 0, 'latest')
      // build map of latest attached cid per batchId
      const docMap: Record<string, { cid: string; ts: number }> = {}
      events.forEach((ev: any) => {
        try {
          const args = ev.args || ev.data || {}
          const batchId = String(args[0] ?? args.batchId ?? '')
          const ipfs = String(args[1] ?? args.ipfsHash ?? '')
          const ts = Number(args[2]?.toString?.() ?? Date.now())
          if (!batchId) return
          const prev = docMap[batchId]
          if (!prev || ts > prev.ts) docMap[batchId] = { cid: ipfs, ts }
        } catch (err) {
          // ignore malformed event
        }
      })
      // attach to results where appropriate
      for (let r of results) {
        const bid = String(r.batchId)
        const doc = docMap[bid]
        if (doc && doc.cid) {
          // if the attached cid is different from intake ipfsHash, consider it an attached doc (e.g., price)
          if (String(doc.cid) !== String(r.ipfsHash)) {
            r.ipfsPriceCid = doc.cid
            r.export = { ...r.export, ipfsPriceCid: doc.cid }
          } else {
            // still record it on top-level if no other
            r.ipfsPriceCid = doc.cid
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch DocumentAttached events', e)
    }
    const key = `coffeeTrace.batches.${contractInfo.address}`
    window.localStorage.setItem(key, JSON.stringify(results))
  } catch (e) {
    console.warn('Failed to write batches to localStorage', e)
  }

  return results
}
