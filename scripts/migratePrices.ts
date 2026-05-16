import { ethers } from 'ethers'
import fs from 'fs'
import contractInfo from '../src/contracts/contractInfo.json'

// Usage: set env PRIVATE_KEY and RPC_URL, then run `ts-node scripts/migratePrices.ts prices.json`
async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Please provide path to prices JSON produced from export')
    process.exit(1)
  }
  const file = args[0]
  const raw = fs.readFileSync(file, 'utf8')
  const data = JSON.parse(raw) as Array<{ batchId: string; pricePerKgRWF: number }>

  const rpc = process.env.RPC_URL || process.env.VITE_RPC_URL
  const pk = process.env.PRIVATE_KEY
  if (!rpc || !pk) {
    console.error('RPC_URL and PRIVATE_KEY must be set as env vars')
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)
  const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, wallet)

  for (const item of data) {
    try {
      console.log('Setting price for', item.batchId, item.pricePerKgRWF)
      const tx = await contract.logExportWithPrice(item.batchId, '', '', '', '', item.pricePerKgRWF)
      const receipt = await tx.wait()
      console.log('Tx:', receipt.transactionHash)
    } catch (e) {
      console.error('Failed for', item.batchId, e)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
