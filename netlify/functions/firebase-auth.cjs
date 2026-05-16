const { ethers } = require('ethers')
const admin = require('firebase-admin')

const zlib = require('zlib')
const getServiceAccount = () => {
  // Support compressed env var FIREBASE_SERVICE_ACCOUNT_GZIP (base64 of gzip)
  const gz = process.env.FIREBASE_SERVICE_ACCOUNT_GZIP || process.env.VITE_FIREBASE_SERVICE_ACCOUNT_GZIP
  if (gz) {
    try {
      const buf = Buffer.from(String(gz), 'base64')
      const json = zlib.gunzipSync(buf).toString('utf8')
      return JSON.parse(json)
    } catch (e) {
      console.warn('Failed to decode FIREBASE_SERVICE_ACCOUNT_GZIP', e)
    }
  }

  const v = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.VITE_FIREBASE_SERVICE_ACCOUNT || ''
  if (!v) return null
  try {
    // allow base64-encoded JSON or raw JSON
    const decoded = Buffer.from(String(v), 'base64').toString('utf8')
    const obj = JSON.parse(decoded)
    return obj
  } catch (e) {
    try { return JSON.parse(v) } catch (e2) { return null }
  }
}

const getAdminWallets = () => {
  const raw = process.env.ADMIN_WALLETS || ''
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

    const body = JSON.parse(event.body || '{}')
    const { address, message, signature } = body
    if (!address || !message || !signature) return { statusCode: 400, body: JSON.stringify({ error: 'address, message, signature required' }) }

    let recovered
    try { recovered = ethers.verifyMessage(message, signature) } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) } }
    if (recovered.toLowerCase() !== address.toLowerCase()) return { statusCode: 401, body: JSON.stringify({ error: 'Signature does not match address' }) }

    const allowed = getAdminWallets()
    if (allowed.length > 0 && !allowed.includes(address.toLowerCase())) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Address not authorized as admin' }) }
    }

    const serviceAccount = getServiceAccount()
    if (!serviceAccount) return { statusCode: 500, body: JSON.stringify({ error: 'Missing FIREBASE_SERVICE_ACCOUNT in env' }) }

    // initialize admin sdk once
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    }

    const uid = `wallet:${address.toLowerCase()}`
    try {
      await admin.auth().getUser(uid)
    } catch (err) {
      // create user if not exists
      try { await admin.auth().createUser({ uid, displayName: `Admin ${address.slice(0,6)}` }) } catch (e) { /* ignore if exists concurrently */ }
    }

    // set admin custom claim
    await admin.auth().setCustomUserClaims(uid, { isAdmin: true })

    const customToken = await admin.auth().createCustomToken(uid)
    return { statusCode: 200, body: JSON.stringify({ customToken }) }
  } catch (err) {
    console.error('firebase-auth failed', err)
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) }
  }
}
