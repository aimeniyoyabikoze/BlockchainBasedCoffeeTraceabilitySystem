import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import contractInfo from '../contracts/contractInfo.json'
import { ensureAdminFirebaseSession } from '../services/authService'

export type UserRoles = {
  isAdmin: boolean
  isIntake: boolean
  isProcessor: boolean
  isExporter: boolean
}

export function useWeb3() {
  const [account, setAccount] = useState<string | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [roles, setRoles] = useState<UserRoles>({
    isAdmin: false,
    isIntake: false,
    isProcessor: false,
    isExporter: false
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [desiredChainId, setDesiredChainId] = useState<number | null>(null)
  const [isOnDesiredNetwork, setIsOnDesiredNetwork] = useState<boolean>(true)

  const fetchRoles = async (contractInstance: ethers.Contract, userAddress: string, provider: any) => {
    try {
      // verify contract bytecode exists on the provider the contract is connected to
      const code = await provider.getCode(contractInfo.address)
      if (!code || code === '0x') {
        // try to detect if our configured RPC has the contract
        const rpc = (import.meta.env.VITE_RPC_URL as string) || ''
        if (rpc) {
          try {
            const fallback = new ethers.JsonRpcProvider(rpc)
            const fallbackCode = await fallback.getCode(contractInfo.address)
            if (fallbackCode && fallbackCode !== '0x') {
              const metaNet = await provider.getNetwork()
              const rpcNet = await fallback.getNetwork()
              // store desired chain id for UI guidance
              setDesiredChainId(Number(rpcNet.chainId))
              setIsOnDesiredNetwork(Number(metaNet.chainId) === Number(rpcNet.chainId))
              setError(`Contract not found on MetaMask network (chainId=${metaNet.chainId}). Contract exists on RPC network (chainId=${rpcNet.chainId}). Please switch MetaMask to the correct network.`)
              const emptyRoles = { isAdmin: false, isIntake: false, isProcessor: false, isExporter: false }
              setRoles(emptyRoles)
              return emptyRoles
            }
          } catch (e) {
            // ignore fallback errors
          }
        }
        // no fallback found; try to set desired chain id from env RPC if available
        try {
          const rpc = (import.meta.env.VITE_RPC_URL as string) || ''
          if (rpc) {
            const fallback = new ethers.JsonRpcProvider(rpc)
            const rpcNet = await fallback.getNetwork()
            setDesiredChainId(Number(rpcNet.chainId))
            setIsOnDesiredNetwork(false)
          }
        } catch (e) {}
        setError('Contract not found on the connected network. Please switch MetaMask to the network where the contract is deployed.')
        const emptyRoles = { isAdmin: false, isIntake: false, isProcessor: false, isExporter: false }
        setRoles(emptyRoles)
        return emptyRoles
      }

      const [isAdmin, isIntake, isProcessor, isExporter] = await contractInstance.getUserRoles(userAddress)
      const nextRoles = { isAdmin, isIntake, isProcessor, isExporter }
      setRoles(nextRoles)
      return nextRoles
    } catch (err) {
      console.error('Failed to fetch roles:', err)
      const emptyRoles = { isAdmin: false, isIntake: false, isProcessor: false, isExporter: false }
      setRoles(emptyRoles)
      setError((err as Error)?.message || 'Failed to fetch roles')
      return emptyRoles
    }
  }

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected')
      return false
    }
    const rpc = (import.meta.env.VITE_RPC_URL as string) || ''
    if (!rpc || !desiredChainId) {
      setError('No RPC/chain configured to switch to')
      return false
    }
    try {
      const hexChainId = `0x${desiredChainId.toString(16)}`
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChainId }] })
      setIsOnDesiredNetwork(true)
      setError(null)
      return true
    } catch (switchError: any) {
      // 4902: chain not added to MetaMask
      if (switchError?.code === 4902 && rpc) {
        try {
          const hexChainId = `0x${desiredChainId!.toString(16)}`
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexChainId,
              chainName: 'Target RPC',
              rpcUrls: [rpc],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: []
            }]
          })
          // try switching again
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${desiredChainId!.toString(16)}` }] })
          setIsOnDesiredNetwork(true)
          setError(null)
          return true
        } catch (addErr: any) {
          setError(addErr?.message || 'Failed to add network to MetaMask')
          return false
        }
      }
      setError(switchError?.message || 'Failed to switch network')
      return false
    }
  }, [desiredChainId])
  const AUTOCONNECT_KEY = 'coffeeTrace.wallet.autoconnect'

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const contractInstance = new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        signer
      )

      setAccount(accounts[0])
      setContract(contractInstance)
      // detect current MetaMask network and compare to RPC
      try {
        const metaNet = await provider.getNetwork()
        const rpc = (import.meta.env.VITE_RPC_URL as string) || ''
        if (rpc) {
          const fallback = new ethers.JsonRpcProvider(rpc)
          const rpcNet = await fallback.getNetwork()
          setDesiredChainId(Number(rpcNet.chainId))
          setIsOnDesiredNetwork(Number(metaNet.chainId) === Number(rpcNet.chainId))
        }
      } catch (e) {}
      const nextRoles = await fetchRoles(contractInstance, accounts[0], provider)
      if (nextRoles?.isAdmin) {
        await ensureAdminFirebaseSession(accounts[0])
      }
      try { window.localStorage.setItem(AUTOCONNECT_KEY, 'true') } catch (e) {}
    } catch (err: any) {
      setError(err.message || 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnectWallet = () => {
    setAccount(null)
    setContract(null)
    setRoles({ isAdmin: false, isIntake: false, isProcessor: false, isExporter: false })
    try { 
      // Disable auto-sync explicitly to prevent re-login on reload
      window.localStorage.setItem(AUTOCONNECT_KEY, 'false')
      window.localStorage.setItem('coffeeTrace.autoSync', 'false')
      // Remove all data-related keys except settings
      const keysToRemove = Object.keys(window.localStorage).filter(key => 
        key.startsWith('coffeeTrace') && 
        key !== AUTOCONNECT_KEY && 
        key !== 'coffeeTrace.autoSync'
      )
      keysToRemove.forEach(key => window.localStorage.removeItem(key))
    } catch (e) {}
    // Refresh page to ensure clean slate
    window.location.reload()
  }

  // Check if already connected
  useEffect(() => {
    const pathname = window.location.pathname
    if (pathname.startsWith('/gallery') || pathname.startsWith('/verify')) {
      return
    }

    if (window.ethereum) {
      const shouldAuto = (() => {
        try { return window.localStorage.getItem(AUTOCONNECT_KEY) !== 'false' } catch (e) { return true }
      })()
      if (!shouldAuto) return
      const provider = new ethers.BrowserProvider(window.ethereum)
      provider.listAccounts().then((accounts) => {
        if (accounts.length > 0) {
          connectWallet()
        }
      })
    }
  }, [connectWallet])

  return {
    account,
    contract,
    roles,
    error,
    loading,
    connectWallet,
    disconnectWallet
    , desiredChainId, isOnDesiredNetwork, switchNetwork
  }
}
