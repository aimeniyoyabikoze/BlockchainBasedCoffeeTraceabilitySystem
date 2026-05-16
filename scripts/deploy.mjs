import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { ethers } from 'ethers'

dotenv.config()

async function main() {
  const privateKey = process.env.PRIVATE_KEY

  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required')
  }

  const artifactPath = path.resolve(process.cwd(), 'artifacts', 'contracts', 'CoffeeTrace.sol', 'CoffeeTrace.json')
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))

  const rpcUrls = [
    process.env.RPC_URL,
    process.env.VITE_RPC_URL,
    'https://eth-sepolia.g.alchemy.com/v2/9o0gqlT4uJtxqzqgULxPY',
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org',
  ].filter(Boolean)

  let deployedAddress = null
  let lastError = null

  for (const rpcUrl of rpcUrls) {
    try {
      console.log('Trying RPC:', rpcUrl)
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const wallet = new ethers.Wallet(privateKey, provider)
      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)

      console.log('Deploying CoffeeTrace from', wallet.address)
      const network = await provider.getNetwork()
      console.log('Network chainId:', network.chainId.toString())
      const contract = await factory.deploy()
      await contract.waitForDeployment()

      deployedAddress = await contract.getAddress()
      console.log('CoffeeTrace deployed to:', deployedAddress)
      break
    } catch (err) {
      lastError = err
      console.warn('Deploy attempt failed for RPC:', rpcUrl)
      console.warn(err)
    }
  }

  if (!deployedAddress) {
    throw lastError || new Error('Deployment failed for all RPC endpoints')
  }

  const out = {
    address: deployedAddress,
    abi: artifact.abi,
  }

  const outPath = path.resolve(process.cwd(), 'src', 'contracts', 'contractInfo.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log('Wrote contract info to', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
