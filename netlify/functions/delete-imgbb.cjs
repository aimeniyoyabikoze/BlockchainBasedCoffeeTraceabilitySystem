const https = require('https')

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const payload = JSON.parse(event.body || '{}')
    const { deleteUrl } = payload
    if (!deleteUrl) return { statusCode: 400, body: JSON.stringify({ error: 'deleteUrl required' }) }

    const result = await new Promise((resolve, reject) => {
      const req = https.get(deleteUrl, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve({ status: res.statusCode, body: data }))
      })
      req.on('error', reject)
    })

    return { statusCode: 200, body: JSON.stringify({ ok: true, result }) }
  } catch (err) {
    console.error('delete-imgbb failed', err)
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) }
  }
}
