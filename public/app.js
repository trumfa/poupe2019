const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const norm = (s) => (s || '').replace(/[’‘]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/·/g, '').toLowerCase().trim()
const mil = (n) => n == null ? '—' : n.toLocaleString('ca-ES', { maximumFractionDigits: 0 })
const eur = (n) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const paraf = (t) => esc(t).replace(/(?<=\.)\s+(?=[A-ZÀ-Ú])/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')

let INDEX = [], CADASTRE = {}, CONFIG = {}, GENERALS = null

const fontBopa = (f) => {
  if (!f?.bopa_num) return esc(f?.volum || '')
  const pdf = f.drive_id ? ` · <a href="https://drive.google.com/file/d/${f.drive_id}/view" target="_blank" rel="noopener">fitxa en PDF</a>` : ''
  return `${esc(f.volum)} · BOPA núm. ${esc(f.bopa_num)}, ${esc(f.bopa_data)}, pàg. ${esc(f.bopa_pagina)}${pdf}`
}

async function inici() {
  const [idx, cfg] = await Promise.all([
    fetch('data/index.json').then((r) => r.json()),
    fetch('data/config.json').then((r) => r.json()).catch(() => ({})),
  ])
  INDEX = idx; CONFIG = cfg
  CADASTRE = await fetch('data/cadastre.json').then((r) => r.json()).catch(() => ({}))
  if (cfg.generat) $('#generat').textContent = `Dades actualitzades el ${cfg.generat}. ${INDEX.length} unitats.`
  $('#q').addEventListener('input', cercar)
  window.addEventListener('hashchange', ruta)
  ruta()
}

function cercar() {
  const q = norm($('#q').value)
  const llista = $('#resultats')
  if (q.length < 2) { llista.innerHTML = ''; return }
  const perCadastre = CADASTRE[$('#q').value.trim().toUpperCase()] || CADASTRE[$('#q').value.trim()]
  const ids = perCadastre ? [].concat(perCadastre) : null
  const trobats = (ids ? INDEX.filter((u) => ids.includes(u.id)) : INDEX.filter((u) => u.norm.includes(q))).slice(0, 12)

  if (!trobats.length) {
    llista.innerHTML = `<li class="buit">Cap unitat amb aquest nom. Prova amb una part del nom, o consulta al Comú.</li>`
    return
  }
  llista.innerHTML = trobats.map((u) => `
    <li><button data-id="${esc(u.id)}">
      <span>${esc(u.nom)}</span><span class="meta">${esc(u.classificacio)}</span>
    </button></li>`).join('')
  llista.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { location.hash = 'ua/' + b.dataset.id }))
}

function ruta() {
  const h = location.hash.slice(1)
  $('#detall').hidden = true; $('#pagina').hidden = true; $('#portada').hidden = false
  if (h.startsWith('ua/')) mostrarUA(h.slice(3))
  else if (h) pagina(h)
}

async function mostrarUA(id) {
  const [d] = await Promise.all([
    fetch(`data/ua/${id}.json`).then((r) => r.json()).catch(() => null),
    GENERALS ? Promise.resolve() : fetch('data/apartats-generals.json')
      .then((r) => r.json()).then((g) => { GENERALS = g }).catch(() => { GENERALS = [] }),
  ])
  const cont = $('#detall')
  if (!d) { cont.innerHTML = '<p class="buit">No s\'ha trobat aquesta unitat.</p>'; cont.hidden = false; return }

  $('#portada').hidden = true
  cont.hidden = false
  const v = d.versions.find((x) => x.familia !== 'area') || d.versions[0]

  cont.innerHTML =
    capcaleraHTML(d, v) + avisosHTML(d, v) + resumHTML(v) + calculadoraHTML(v) +
    proteccionsHTML(d) + condicionsHTML(v) + fitxaHTML(v) + clausHTML(v) +
    d.versions.filter((x) => x !== v).map((x) => altraVersioHTML(d, x)).join('') +
    historicHTML(d)

  muntarCalculadora(v)
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function capcaleraHTML(d, v) {
  const esArea = v.familia === 'area'
  return `
  <div class="titol-ua">
    <button class="enrere" onclick="location.hash=''">← Nova consulta</button>
    <h2>${esc(d.nom)}</h2>
    <p class="subtitol">${esArea ? 'Àrea diferenciada en sòl no urbanitzable' : "Unitat d'actuació"}
       · versió vigent ${esc(v.modificacio)}</p>
    <div class="tira">
      <span class="xip xip-vig">Vigent</span>
      ${v.classificacio ? `<span class="xip">${esc(v.classificacio)}</span>` : ''}
      ${v.claus.map((c) => `<span class="xip xip-clau" title="${esc(c.denominacio)}">${esc(c.clau)}</span>`).join('')}
    </div>
  </div>`
}

function avisosHTML(d, v) {
  let h = ''
  if (d.proteccions?.length) h += `<div class="avis avis-prot"><p><strong>Patrimoni protegit.</strong>
    Aquesta unitat té ${d.proteccions.length} bé${d.proteccions.length > 1 ? 'ns' : ''} o espai${d.proteccions.length > 1 ? 's' : ''}
    amb protecció. Consulta les obligacions abans de projectar res.</p></div>`
  if (v.revisar) h += `<div class="avis"><p><strong>Dada pendent de comprovació.</strong>
    ${esc(v.revisar)}. Contrasta-la al Comú abans de prendre cap decisió.</p></div>`
  return h
}

function resumHTML(v) {
  const files = []
  if (v.superficie) files.push(['Superfície de la unitat', mil(v.superficie) + ' m²'])
  if (v.edificabilitat_max) files.push(['Edificabilitat màxima', mil(v.edificabilitat_max) + ' m² de sostre'])
  else if (v.coeficient) files.push(["Coeficient d'edificabilitat",
    String(v.coeficient).replace('.', ',') + ' m² sostre per m² de parcel·la neta'])
  if (v.alcades) files.push(['Alçades', esc(v.alcades).replace(/;/g, '<br>')])
  if (v.parcela_minima) files.push(['Parcel·la mínima', esc(v.parcela_minima) + ' m²'])

  return `
  <div class="bloc">
    <h3>En resum</h3>
    ${v.planol ? `<figure class="planol">
      <img src="https://drive.google.com/thumbnail?id=${esc(v.planol)}&sz=w1200"
           alt="Plànol de la fitxa" loading="lazy">
      <figcaption>Plànol de la fitxa publicada al BOPA. Per a la delimitació exacta, consulta els
        plànols d'ordenació.</figcaption></figure>` : ''}
    <dl class="dades">${files.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>
    <p class="font">${fontBopa(v.font)}</p>
  </div>`
}

function calculadoraHTML(v) {
  if (v.familia === 'area') return `
    <div class="bloc">
      <h3>Es pot edificar?</h3>
      <p>Les àrees diferenciades en sòl no urbanitzable no tenen aprofitament privat. Si el Govern
         modifica la consideració d'afectació, l'àrea s'integra a la unitat d'actuació del mateix
         nom amb les seves condicions.</p>
      <p class="font">Normes urbanístiques, article 8</p>
    </div>`

  if (!v.coeficient && !v.edificabilitat_max) return `
    <div class="bloc">
      <h3>Quant es pot edificar</h3>
      <p>Aquesta unitat no té coeficient d'edificabilitat: el volum edificable el determinen la
         fitxa i els límits d'alçada. Consulta-ho al Comú.</p>
    </div>`

  return `
  <div class="bloc">
    <h3>Calcula per a la teva parcel·la</h3>
    ${v.edificabilitat_max
      ? `<p>Aquesta unitat té l'edificabilitat assignada a la fitxa: <strong>${mil(v.edificabilitat_max)} m²
         de sostre</strong> per al conjunt de la unitat.</p>`
      : `<p>El coeficient s'aplica sobre la <strong>parcel·la neta</strong>: la superfície un cop
         descomptats els vials i els cursos d'aigua.</p>`}
    <div class="calc-camps">
      <div><label for="sup">Superfície de la parcel·la (m²)</label>
        <input type="text" id="sup" inputmode="numeric" placeholder="480"></div>
      <div><label for="neta">Aquesta xifra…</label>
        <select id="neta">
          <option value="1">ja descompta vials i cursos d'aigua</option>
          <option value="0">és la superfície total</option>
        </select></div>
    </div>
    <div id="sortida"></div>
    <div class="opcions">
      <label><input type="checkbox" id="bonif"> Es destina a habitatge, aparcament o ús agrícola o
        ramader (bonificació del 90% de l'impost)</label>
    </div>
    <div class="avis"><p><strong>Càlcul estimatiu.</strong> No té valor de llicència ni de
      liquidació. L'aprofitament i els imports definitius resulten de la resolució de la
      sol·licitud. La cessió urbanística no es calcula aquí: consulta-la al Comú.</p></div>
    <p class="font">Coeficient: Normes urbanístiques, ${esc(v.article_coef || 'articles 62 a 66')} ·
       Parcel·la neta: article 18.1 · Impost sobre la construcció: ordinació tributària, article 59</p>
  </div>`
}

function muntarCalculadora(v) {
  const sup = $('#sup'), neta = $('#neta'), bonif = $('#bonif'), out = $('#sortida')
  if (!sup) return
  const imp = CONFIG.impost_construccio || { tipus: 48.18, index_localitzacio: 1.37, bonificacio: 0.9 }

  const recalcular = () => {
    const brut = parseFloat(String(sup.value).replace(/[^\d,.]/g, '').replace(',', '.'))
    if (!Number.isFinite(brut) || brut <= 0) { out.innerHTML = ''; return }
    if (neta.value === '0') {
      out.innerHTML = `<div class="resultat"><p class="etiqueta">Falta una dada</p>
        <p class="com">El coeficient s'aplica sobre la parcel·la neta. Descompta primer la part
        corresponent a vials i cursos d'aigua, o consulta-la al Comú.</p></div>`
      return
    }
    let html = ''
    if (v.coeficient) {
      const sostre = Math.round(brut * v.coeficient)
      html += `<div class="resultat">
        <p class="etiqueta">Sostre màxim estimat</p>
        <p class="xifra">${mil(sostre)} m²</p>
        <p class="com">${mil(brut)} m² × ${String(v.coeficient).replace('.', ',')} m² sostre/m² sòl</p></div>`
      html += impostHTML(sostre, imp, bonif.checked)
    } else if (v.edificabilitat_max) {
      html += impostHTML(v.edificabilitat_max, imp, bonif.checked)
    }
    out.innerHTML = html
  }
  ;[sup, neta, bonif].forEach((el) => el.addEventListener('input', recalcular))
}

function impostHTML(sostre, imp, bonificat) {
  const quota = sostre * imp.index_localitzacio * imp.tipus
  const final = bonificat ? quota * (1 - imp.bonificacio) : quota
  return `<div class="resultat">
    <p class="etiqueta">Impost sobre la construcció, estimat</p>
    <p class="xifra">${eur(final)}</p>
    <p class="com">${mil(sostre)} m² × ${String(imp.index_localitzacio).replace('.', ',')} × ${String(imp.tipus).replace('.', ',')} €/m²${bonificat ? `, amb la bonificació del 90% sobre ${eur(quota)}` : ''}</p>
  </div>`
}

function proteccionsHTML(d) {
  if (!d.proteccions?.length) return ''
  const cats = [...new Set(d.proteccions.map((p) => p.categoria))]
  return `
  <div class="bloc">
    <h3>Patrimoni protegit</h3>
    ${cats.map((c) => {
      const items = d.proteccions.filter((p) => p.categoria === c)
      return `<p class="cat">${esc(c)}</p>
        <ul class="llista">${items.map((p) =>
          `<li>${esc(p.nom)}${p.adreca ? ` <span class="meta">· ${esc(p.adreca)}</span>` : ''}</li>`).join('')}</ul>
        ${items[0].obligacio ? `<p class="obligacio">${esc(items[0].obligacio)}</p>` : ''}`
    }).join('')}
    <p class="font">POUPE Vol. IX — Catàleg comunal d'edificis, espais i elements d'interès
       històric, monumental i cultural · Normes urbanístiques, articles 81 a 84</p>
  </div>`
}

// Condicions constructives: primer el que anomena les teves claus, després el general plegat.
function condicionsHTML(v) {
  const meus = v.apartats || []
  const temes = (CONFIG.temes || []).filter((t) =>
    meus.some((a) => a.tema === t) || (GENERALS || []).some((a) => a.tema === t))
  if (!temes.length) return ''

  return `
  <div class="bloc">
    <h3>Condicions constructives</h3>
    <p>Els apartats de les Normes urbanístiques que anomenen les teves claus es mostren directament.
       La resta de condicions, que s'apliquen a tothom, són a sota de cada tema.</p>
    ${temes.map((t) => {
      const propis = meus.filter((a) => a.tema === t)
      const gen = (GENERALS || []).filter((a) => a.tema === t)
      return `
      <div class="tema">
        <p class="cat">${esc(t[0].toUpperCase() + t.slice(1))}</p>
        ${propis.length ? propis.map((a) => `
          <div class="apartat">
            <p class="etiqueta-ap">${esc(a.article)}.${esc(a.apartat)} · ${esc(a.titol)}
              <span class="xip xip-clau">${a.claus.map(esc).join(' ')}</span>
              ${a.abast === 'general amb menció' ? '<span class="meta">regla específica dins d\'un apartat general</span>' : ''}</p>
            ${paraf(a.text)}
          </div>`).join('')
          : `<p class="meta">Cap apartat específic per a les teves claus.</p>`}
        ${gen.length ? `<details class="art">
          <summary>Condicions generals de ${esc(t)} (${gen.length} apartat${gen.length > 1 ? 's' : ''})</summary>
          <div class="art-cos">${gen.map((a) => `
            <p class="etiqueta-ap">${esc(a.article)}.${esc(a.apartat)}</p>${paraf(a.text)}`).join('')}</div>
        </details>` : ''}
      </div>`
    }).join('')}
    <p class="font">POUPE Vol. II — Normes urbanístiques (Modificació 04) · BOPA núm. 135, 12/11/2025.
       L'assignació d'apartats a cada clau es fa a partir de les claus que el text de cada apartat
       anomena expressament.</p>
  </div>`
}

function fitxaHTML(v) {
  const camps = [
    ['Zona', v.zones.map((z) => `${esc(z.nom)} (${esc(z.clau)})`).join(', ') || '—'],
    ['Subzona', v.subzones.map((z) => `${esc(z.nom)} (${esc(z.clau)})`).join(', ') || '—'],
    v.sistema_ordenacio ? ["Sistema d'ordenació", esc(v.sistema_ordenacio)] : null,
    v.front_minim ? ['Front mínim', esc(v.front_minim) + ' m'] : null,
  ].filter(Boolean)
  return `
  <div class="bloc">
    <h3>La fitxa completa</h3>
    <details class="art">
      <summary>Text de la fitxa publicada al BOPA</summary>
      <div class="art-cos">
        ${v.descripcio ? paraf(v.descripcio) : ''}
        <dl class="dades">${camps.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>
        ${v.ordenacio ? `<p class="cat">Condicions d'ordenació i edificació</p>${paraf(v.ordenacio)}` : ''}
        ${v.usos ? `<p class="cat">Condicions d'ús</p>${paraf(v.usos)}` : ''}
        ${v.gestio ? `<p class="cat">Condicions de gestió i execució</p>${paraf(v.gestio)}` : ''}
      </div>
    </details>
    <p class="font">${fontBopa(v.font)}</p>
  </div>`
}

function clausHTML(v) {
  if (!v.claus.length) return ''
  return `
  <div class="bloc">
    <h3>Les teves claus</h3>
    ${v.claus.map((c) => {
      const p = c.parametres.filter((x) => x.v)
      return `<details class="art">
        <summary><strong>${esc(c.clau)}</strong> · ${esc(c.denominacio || 'clau no definida')}
          <span class="meta">${esc(c.tipus)}</span></summary>
        <div class="art-cos">
          ${c.subdivisions.length ? `<p>Es desglossa en: ${c.subdivisions.map((s) =>
            `${esc(s.codi)} ${esc(s.nom)}`).join(', ')}.</p>` : ''}
          ${p.length ? `<dl class="dades">${p.map((x) =>
            `<dt>${esc(x.p)}</dt><dd>${x.n ? `<strong>${esc(x.n)} ${esc(x.u || '')}</strong> · ` : ''}${esc(x.v)}</dd>`).join('')}</dl>`
            : '<p>Aquesta clau no fixa paràmetres propis.</p>'}
          <p class="font">Normes urbanístiques, ${esc(c.article)}</p>
        </div>
      </details>`
    }).join('')}
  </div>`
}

function altraVersioHTML(d, v) {
  return `
  <div class="bloc">
    <h3>També hi ha una àrea diferenciada amb aquest nom</h3>
    <p>${esc(d.nom)} consta també com a àrea diferenciada en sòl no urbanitzable${v.superficie ? `, de ${mil(v.superficie)} m²` : ''}.
       És un àmbit diferent de la unitat d'actuació, amb el seu propi règim.</p>
    ${v.descripcio ? `<details class="art"><summary>Veure la fitxa</summary>
      <div class="art-cos">${paraf(v.descripcio)}</div></details>` : ''}
    <p class="font">${fontBopa(v.font)}</p>
  </div>`
}

function historicHTML(d) {
  if (d.historic.length < 2) return `
    <div class="bloc"><h3>Històric</h3>
      <p>Aquesta unitat no s'ha modificat des de l'aprovació del Pla.</p></div>`
  return `
  <div class="bloc">
    <h3>Històric de modificacions</h3>
    <table class="hist">
      <tr><th>Versió</th><th>Publicació</th><th></th></tr>
      ${d.historic.map((h) => `<tr>
        <td>${esc(h.modificacio)}${h.vigent ? ' · <strong>vigent</strong>' : ''}</td>
        <td>${esc(h.fase || '')}<br><span class="meta">BOPA núm. ${esc(h.bopa_num)}, ${esc(h.bopa_data)}</span></td>
        <td>${h.drive_id ? `<a href="https://drive.google.com/file/d/${h.drive_id}/view" target="_blank" rel="noopener">PDF</a>` : ''}</td>
      </tr>`).join('')}
    </table>
    <p class="font">Preval sempre la darrera modificació. Les versions anteriors es conserven a
       efectes de consulta.</p>
  </div>`
}

async function pagina(nom) {
  const cont = $('#pagina')
  $('#portada').hidden = true; cont.hidden = false
  if (nom === 'glossari') {
    const g = await fetch('data/glossari.json').then((r) => r.json())
    cont.innerHTML = `<div class="bloc"><h3>Glossari</h3>${g.map((t) => `
      <div class="terme"><p class="cat">${esc(t.terme)}</p><p>${esc(t.definicio_planera)}</p>
        <p class="font">${esc(t.font)}${t.article ? ', ' + esc(t.article) : ''}</p></div>`).join('')}</div>`
  } else if (nom === 'claus') {
    const c = await fetch('data/claus.json').then((r) => r.json())
    cont.innerHTML = `<div class="bloc"><h3>Claus urbanístiques</h3>
      <dl class="dades">${c.map((x) => `<dt class="xip-clau">${esc(x.clau)}</dt>
        <dd>${esc(x.denominacio)}${x.coef_edificabilitat ? ` · coeficient ${esc(x.coef_edificabilitat)} m² sostre/m² sòl` : ''}
        <span class="meta"><br>${esc(x.article)}</span></dd>`).join('')}</dl></div>`
  } else if (nom === 'normativa') {
    const a = await fetch('data/normativa.json').then((r) => r.json())
    const arts = [...new Set(a.map((x) => x.article))]
    cont.innerHTML = `<div class="bloc"><h3>Normes urbanístiques</h3>
      ${arts.map((art) => {
        const ap = a.filter((x) => x.article === art)
        return `<details class="art"><summary>${esc(art)} · ${esc(ap[0].titol)}</summary>
          <div class="art-cos">${ap.map((x) => `<p class="etiqueta-ap">${esc(x.apartat)}.${
            x.claus?.length ? ` <span class="xip xip-clau">${x.claus.map(esc).join(' ')}</span>` : ''}</p>
            ${paraf(x.text)}`).join('')}</div></details>`
      }).join('')}
      <p class="font">POUPE Vol. II (Modificació 04) · BOPA núm. 135, 12/11/2025</p></div>`
  } else if (nom === 'preguntes') {
    const r = await fetch('data/regles.json').then((res) => res.json())
    cont.innerHTML = `<div class="bloc"><h3>Preguntes freqüents</h3>${r
      .filter((x) => x.estat !== 'NO CALCULABLE' && x.nom && !String(x.id_regla).startsWith('PARAM'))
      .map((x) => `<div class="terme"><p class="cat">${esc(x.nom)}</p><p>${esc(x.formula)}</p>
        ${x.observacions ? `<p class="meta">${esc(x.observacions)}</p>` : ''}
        <p class="font">${esc(x.font)}, ${esc(x.article)}</p></div>`).join('')}</div>`
  }
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

inici()
