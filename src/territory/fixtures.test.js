import { test, expect, beforeEach } from 'vitest'
import { resetAll } from '../test/resetDbs.js'
import { saveCustomer, saveFarm } from './store.js'
import { allFarms, customer } from './fixtures.js'

beforeEach(resetAll)

// Fixtures must be records the store would accept (valid enum values).
test('every fixture farm passes store validation (M4)', async () => {
  await saveCustomer(customer)
  for (const f of allFarms) {
    await expect(saveFarm(f)).resolves.toMatchObject({ id: f.id, locationSource: f.locationSource })
  }
})
