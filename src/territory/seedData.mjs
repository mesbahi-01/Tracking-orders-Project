// Synthetic seed data (design spec section 6.9): one demo customer with 8 farms.
// All names, links and coordinates are invented. Real customer data stays in the
// git-ignored "Client's Farms/" folder. The importer never resolves short links.
export const SEED_CUSTOMER = { name: 'Client Démo', region: 'Région Test' }

// [farm name, short link, lat, lng, capacity, verify]
export const SEED_FARM_ROWS = [
  ['مزرعة الأمل', 'https://maps.app.goo.gl/DEMOLINK0000000001', 34.518505, -5.622656, 40000, false],
  ['مزرعة النور', 'https://maps.app.goo.gl/DEMOLINK0000000002', 34.498872, -5.602563, 42000, false],
  ['مزرعة الواحة', 'https://maps.app.goo.gl/DEMOLINK0000000003', 34.491295, -5.610422, 40000, true],
  ['مزرعة السلام', 'https://maps.app.goo.gl/DEMOLINK0000000004', 34.453587, -5.570246, 32000, false],
  ['مزرعة الربيع', 'https://maps.app.goo.gl/DEMOLINK0000000005', 34.558805, -5.540653, 32000, false],
  ['مزرعة الخير 1', 'https://maps.app.goo.gl/DEMOLINK0000000006', 34.575806, -5.579404, 22000, false],
  ['مزرعة الخير 2', 'https://maps.app.goo.gl/DEMOLINK0000000007', 34.568115, -5.567138, 10000, true],
  ['مزرعة الزيتون', 'https://maps.app.goo.gl/DEMOLINK0000000008', 34.590505, -5.535438, 15000, true],
]
