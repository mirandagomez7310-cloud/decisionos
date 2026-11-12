const fs = require('node:fs')
const state = JSON.parse(fs.readFileSync('e2e/.auth/owner.json', 'utf8'))
const cookie = state.cookies
  .filter((cookie) => cookie.domain === '127.0.0.1')
  .map((cookie) => `${cookie.name}=${cookie.value}`)
  .join('; ')
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start',
      url: [
        'http://127.0.0.1:3000/o/e2e-members',
        'http://127.0.0.1:3000/o/e2e-members/settings/members',
      ],
      numberOfRuns: 3,
      settings: {
        extraHeaders: { Cookie: cookie },
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
  },
}
