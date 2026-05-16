const uploadEndpoint = import.meta.env.VITE_IPFS_UPLOAD_ENDPOINT || '/.netlify/functions/upload-ipfs'

const fileToBase64 = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export const uploadToIPFS = async (file: File) => {
  try {
    const content = await fileToBase64(file)
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        content,
      }),
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(message || `Upload proxy failed with status ${response.status}`)
    }

    const payload = await response.json()
    if (!payload?.cid) {
      throw new Error('Upload proxy did not return a CID')
    }

    return String(payload.cid)
  } catch (error) {
    console.error("Error uploading to IPFS:", error)
    throw error
  }
}

export const getIPFSUrl = (cid: string) => {
  const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'ipfs.io'
  return `https://${gateway}/ipfs/${cid}`
}
