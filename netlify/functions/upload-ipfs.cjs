const { PinataSDK } = require('pinata')

const zlib = require('zlib')
const getJwt = () => {
  const gz = process.env.PINATA_JWT_GZIP || process.env.VITE_PINATA_JWT_GZIP
  if (gz) {
    try {
      const buf = Buffer.from(String(gz), 'base64')
      return zlib.gunzipSync(buf).toString('utf8')
    } catch (e) {
      console.warn('Failed to decode PINATA_JWT_GZIP', e)
    }
  }
  return process.env.PINATA_JWT || process.env.VITE_PINATA_JWT || ''
}

const getGateway = () => process.env.PINATA_GATEWAY || process.env.VITE_PINATA_GATEWAY || 'ipfs.io'

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' }),
      }
    }

    const jwt = getJwt()
    if (!jwt) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing Pinata JWT in environment' }),
      }
    }

    const payload = JSON.parse(event.body || '{}')
    const { filename, mimeType, content } = payload

    if (!filename || !content) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'filename and content are required' }),
      }
    }

    const buffer = Buffer.from(String(content), 'base64')
    const file = new File([buffer], String(filename), { type: String(mimeType || 'application/octet-stream') })

    const pinata = new PinataSDK({
      pinataJwt: jwt,
      pinataGateway: getGateway(),
    })

    const upload = await pinata.upload.public.file(file)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid: upload.cid }),
    }
  } catch (error) {
    console.error('Pinata upload proxy failed:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Upload failed' }),
    }
  }
}