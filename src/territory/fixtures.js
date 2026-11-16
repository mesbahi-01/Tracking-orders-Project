// Shared test fixtures for territory modules.
import { SEED_FARM_ROWS } from './seedData.mjs'

const T = 1700000000000

export const customer = {
  id: 'c1', name: 'Client Démo', nameKey: 'client démo', phone: '', email: '',
  region: 'Région Test', address: '', notes: '', createdAt: T, updatedAt: T,
}

const mk = (id, name, lat, lng, capacity, locationStatus, extra = {}) => ({
  id, name, customerId: 'c1', ownerName: '', status: 'customer', lat, lng,
  locationSource: lat === null ? null : 'import', locationAccuracy: null, locationStatus,
  region: 'Région Test', address: '', capacity, notes: '', createdAt: T, updatedAt: T, ...extra,
})

export const seedFarms = SEED_FARM_ROWS.map(([name, , lat, lng, capacity, verify], i) =>
  mk(`f${i + 1}`, name, lat, lng, capacity, verify ? 'verify' : 'ok'))

export const prospectFarm = mk('f9', 'مزرعة الجار', 34.52, -5.62, 20000, 'ok', {
  customerId: null, ownerName: 'Voisin', status: 'prospect', region: '',
})

export const unlocatedFarm = mk('f10', 'مزرعة بدون موقع', null, null, null, 'missing')

export const allFarms = [...seedFarms, prospectFarm, unlocatedFarm]
export const customers = [customer]
export const customersById = { [customer.id]: customer }
