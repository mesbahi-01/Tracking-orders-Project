// Builds the seed workbook (spec section 6.9). Run with `npm run seed:xlsx` to
// write "Client's Farms/seed-farms.xlsx" locally. If "Client's Farms/seed-local.json"
// exists (git-ignored, real customer data) it is used; otherwise the synthetic
// demo dataset from src/territory/seedData.mjs is used. Never commit that folder.
import * as XLSX from 'xlsx'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SEED_CUSTOMER, SEED_FARM_ROWS } from '../src/territory/seedData.mjs'

export const SEED_HEADERS = ['Client', 'Farm', 'Latitude', 'Longitude', 'Capacity', 'Maps link', 'Verify', 'Region']

const demoRows = () => SEED_FARM_ROWS.map(([name, link, lat, lng, capacity, verify]) => [
  SEED_CUSTOMER.name, name, lat, lng, capacity, link, verify, SEED_CUSTOMER.region,
])

// rows: [client, farm, lat, lng, capacity, link, verify(boolean), region]
export function buildSeedWorkbook(rows = demoRows()) {
  const out = rows.map(([client, farm, lat, lng, capacity, link, verify, region]) => [
    client, farm, lat, lng, capacity, link, verify ? 'yes' : null, region,
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([SEED_HEADERS, ...out]), 'Farms')
  return wb
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const dir = resolve(root, "Client's Farms")
  const localFile = resolve(dir, 'seed-local.json')
  let rows
  if (existsSync(localFile)) {
    rows = JSON.parse(readFileSync(localFile, 'utf8')).farms
    console.log(`Using local data from ${localFile}`)
  } else {
    rows = demoRows()
    console.log('No Client\'s Farms/seed-local.json found: using the synthetic demo data.')
  }
  const out = resolve(dir, 'seed-farms.xlsx')
  mkdirSync(dir, { recursive: true })
  writeFileSync(out, XLSX.write(buildSeedWorkbook(rows), { type: 'buffer', bookType: 'xlsx' }))
  console.log(`Wrote ${out}`)
}
