import { OPENROUTER_API_KEY } from '~/secrets.js'

const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'deepseek/deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Respond with ONLY valid JSON: {"greeting":"hello"}' }],
    response_format: { type: 'json_object' },
    max_tokens: 500,
  }),
})

const data = await resp.json()
console.log('Status:', resp.status)
console.log(JSON.stringify(data, null, 2))
