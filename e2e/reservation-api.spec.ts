import { test, expect } from '@playwright/test'

test.describe('Reservation API Security', () => {
  test('GET /api/reservations returns 401 without authentication', async ({ request }) => {
    const response = await request.get('/api/reservations')
    expect(response.status()).toBe(401)
  })

  test('POST /api/reservations returns 403 with missing CSRF headers', async ({ request }) => {
    const response = await request.post('/api/reservations', {
      data: { check_in_date: '2026-08-01', check_out_date: '2026-08-05' },
    })
    expect(response.status()).toBe(403)
  })

  test('POST /api/reservations returns 401 with valid CSRF but no auth', async ({ request }) => {
    const response = await request.post('/api/reservations', {
      headers: {
        origin: 'http://localhost:3000',
        cookie: 'csrf-token=known-csrf-token',
        'x-csrf-token': 'known-csrf-token',
        'content-type': 'application/json',
      },
      data: { check_in_date: '2026-08-01', check_out_date: '2026-08-05' },
    })
    expect(response.status()).toBe(401)
  })
})
