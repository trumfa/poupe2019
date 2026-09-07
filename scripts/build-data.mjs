// Baixa les pestanyes del full de càlcul i genera els JSON que consumeix la web.
// Ús:  node scripts/build-data.mjs
// El full ha d'estar compartit com a "qualsevol amb l'enllaç pot veure".

import { writeFile, mkdir, rm } from 'node:fs/promises'

const FULL = '1lOE1ahkudXNJS8tix0RBt0_RywUHxiJITqpmcSdkkls'
const OUT = 'public/data'

const url = (tab) =>
  `https://docs.google.com/spreadsheets/d/${FULL}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`

function parseCSV(text) {
  const files = []
  let camp = '', fila = [], dins = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (dins) {
      if (c === '"' && text[i + 1] === '"') { camp += '"'; i++ }
      else if (c === '"') dins = false
      else camp += c
    } else if (c === '"') dins = true
    else if (c === ',') { fila.push(camp); camp = '' }
    else if (c === '\n') { fila.push(camp); files.push(fila); fila = []; camp = '' }
    else if (c !== '\r') camp += c
  }
  if (camp || fila.length) { fila.push(camp); files.push(fila) }
  const caps = files.shift().map((h) => h.trim())
  return files
    .filter((f) => f.some((v) => v.trim()))
    .map((f) => Object.fromEntries(caps.map((h, i) => [h, (f[i] ?? '').trim()])))
}

async function pestanya(nom) {
  const r = await fetch(url(nom))
  if (!r.ok) throw new Error(`No s'ha pogut llegir la pestanya "${nom}" (${r.status}). Comprova que el full estigui compartit amb l'enllaç.`)
  const files = parseCSV(await r.text())
  console.log(`  ${nom}: ${files.length} files`)
  return files
}

const norm = (s) =>
  (s || '').replace(/[’‘]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/·/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

const num = (s) => {
  const n = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const claus = (s) =>
  [...String(s || '').matchAll(/([^;]+?)\s*\(Clau\s*([^)]+)\)/g)]
    .map((m) => ({ nom: m[1].trim(), clau: m[2].trim() }))

console.log('Baixant el full de càlcul…')
const [ua, fitxes, params, cls, clsParam, glossari, regles, tributs, subdiv] =
  await Promise.all(['UA', 'Fitxes', 'Parametres', 'Claus', 'Claus_parametres',
    'Glossari', 'Regles_calcul', 'Tributs', 'Claus_subdivisions'].map(pestanya))

const fitxaPerId = Object.fromEntries(fitxes.map((f) => [f.id_fitxa, f]))
const uaDeFitxa = (p) => p.id_ua || fitxaPerId[p.id_fitxa]?.id_ua || ''
const clauPerCodi = Object.fromEntries(cls.map((c) => [c.clau, c]))

await rm(OUT, { recursive: true, force: true })
await mkdir(`${OUT}/ua`, { recursive: true })

const index = []

for (const u of ua) {
  const id = u.id_ua
  if (!id || id.startsWith('VOLUM_')) continue

  const meves = fitxes.filter((f) => f.id_ua === id)
  const vigents = params.filter((p) => uaDeFitxa(p) === id)
  if (!vigents.length) continue

  const versions = vigents.map((p) => {
    const zones = claus(p.zones), subzones = claus(p.subzones)
    const totes = [...zones, ...subzones].map((z) => z.clau)
    const coef = zones.map((z) => num(clauPerCodi[z.clau]?.coef_edificabilitat))
      .filter(Boolean)

    return {
      id_fitxa: p.id_fitxa,
      volum: p.volum,
      modificacio: p.modificacio,
      familia: p.volum === 'VII' ? 'area' : 'ua',
      tipus: p.tipus_fitxa,
      classificacio: p.classificacio,
      superficie: num(p.superficie_m2),
      superficie_text: p.superficie_m2,
      edificabilitat_max: num(p.edificabilitat_max_m2),
      sistema_ordenacio: p.sistema_ordenacio,
      parcela_minima: p.parcela_minima_m2,
      front_minim: p.front_minim_m,
      zones, subzones,
      coeficient: coef.length ? Math.max(...coef) : null,
      article_coef: zones.map((z) => clauPerCodi[z.clau]?.article).filter(Boolean)[0] || '',
      alcades: p.alcades,
      descripcio: p.descripcio,
      ordenacio: p.ordenacio,
      usos: p.usos,
      gestio: p.gestio,
      cobertura: p.cobertura,
      revisar: p.revisar,
      compartit: p.compartit,
      compartit_amb: p.compartit_amb,
      claus: [...new Set(totes)].map((c) => ({
        clau: c,
        denominacio: clauPerCodi[c]?.denominacio || '',
        tipus: clauPerCodi[c]?.tipus || '',
        article: clauPerCodi[c]?.article || '',
        parametres: clsParam.filter((x) => x.clau === c)
          .map((x) => ({ p: x.parametre, v: x.valor, n: x.valor_numeric, u: x.unitat, remet: x.remet_a })),
        subdivisions: subdiv.filter((s) => s.clau_mare === c)
          .map((s) => ({ codi: s.codi, nom: s.denominacio })),
      })),
      font: {
        volum: `POUPE Vol. ${p.volum}`,
        bopa_num: p.bopa_num, bopa_data: p.bopa_data, bopa_pagina: p.bopa_pagina,
        fase: p.fase_aprovacio, drive_id: p.drive_id,
      },
    }
  })

  const historic = meves.map((f) => ({
    modificacio: f.modificacio, volum: f.volum, vigent: f.vigent === 'SÍ',
    bopa_num: f.bopa_num, bopa_data: f.bopa_data, bopa_pagina: f.bopa_pagina,
    fase: f.fase_aprovacio, drive_id: f.drive_id,
  })).sort((a, b) => a.modificacio.localeCompare(b.modificacio))

  await writeFile(`${OUT}/ua/${id}.json`,
    JSON.stringify({ id, nom: u.nom_oficial, versions, historic }, null, 0))

  index.push({
    id, nom: u.nom_oficial, norm: norm(u.nom_oficial),
    classificacio: versions.map((v) => v.classificacio).filter(Boolean).join(' · '),
    families: [...new Set(versions.map((v) => v.familia))],
    revisar: versions.some((v) => v.revisar),
  })
}

index.sort((a, b) => a.nom.localeCompare(b.nom, 'ca'))

const tribut = (id) => tributs.find((t) => t.id_tribut === id) || {}

await writeFile(`${OUT}/index.json`, JSON.stringify(index))
await writeFile(`${OUT}/glossari.json`, JSON.stringify(glossari))
await writeFile(`${OUT}/claus.json`, JSON.stringify(cls))
await writeFile(`${OUT}/regles.json`, JSON.stringify(
  regles.filter((r) => r.estat !== 'PENDENT DE REDACTAR')))
await writeFile(`${OUT}/config.json`, JSON.stringify({
  generat: new Date().toISOString().slice(0, 10),
  impost_construccio: { tipus: 48.18, index_localitzacio: 1.37, article: 'Art. 59', bonificacio: 0.9 },
  tributs: tributs.filter((t) => t.any === String(new Date().getFullYear()) || t.any),
}))

console.log(`\n${index.length} unitats generades a ${OUT}`)
console.log(`${index.filter((i) => i.revisar).length} amb dades pendents de revisió`)
