const https = require('https')
const querystring = require('querystring')

const getApiKey = () => process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || ''

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' }),
      }
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing IMGBB_API_KEY in environment' }),
      }
    }

    const payload = JSON.parse(event.body || '{}')
    const { filename, content, name } = payload

    if (!content) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'content (base64) is required' }),
      }
    }

    const postData = querystring.stringify({
      key: apiKey,
      image: String(content),
      name: name || filename || 'upload',
    })

    const options = {
      hostname: 'api.imgbb.com',
      path: '/1/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed)
          } catch (e) {
            reject(e)
          }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })

    if (!result || !result.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ImgBB upload failed', details: result }),
      }
    }

    const data = result.data || {}
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: data.url || data.display_url,
        thumbUrl: data.thumb ? data.thumb.url : data.display_url,
        deleteUrl: data.delete_url,
        raw: data,
      }),
    }
  } catch (error) {
    console.error('ImgBB upload proxy failed:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Upload failed' }),
    }
  }
}
