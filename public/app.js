const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const norm = (s) => (s || '').replace(/[’‘]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/·/g, '').toLowerCase().trim()
const mil = (n) => n == null ? '—' : n.toLocaleString('ca-ES', { maximumFractionDigits: 0 })
const eur = (n) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

let INDEX = [], CADASTRE = {}, CONFIG = {}

const fontBopa = (f) => {
  if (!f?.bopa_num) return f?.volum || ''
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

  const perCadastre = CADASTRE[q.toUpperCase()] || CADASTRE[$('#q').value.trim()]
  const ids = perCadastre ? [].concat(perCadastre) : null

  const trobats = (ids ? INDEX.filter((u) => ids.includes(u.id)) : INDEX.filter((u) => u.norm.includes(q))).slice(0, 12)

  if (!trobats.length) {
    llista.innerHTML = `<li class="buit">Cap unitat amb aquest nom. Prova amb una part del nom, o consulta al Comú.</li>`
    return
  }
  llista.innerHTML = trobats.map((u) => `
    <li><button data-id="${esc(u.id)}">
      <span>${esc(u.nom)}${u.revisar ? ' <span class="meta">· dada per revisar</span>' : ''}</span>
      <span class="meta">${esc(u.classificacio)}</span>
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
  const d = await fetch(`data/ua/${id}.json`).then((r) => r.json()).catch(() => null)
  const cont = $('#detall')
  if (!d) { cont.innerHTML = '<p class="buit">No s\'ha trobat aquesta unitat.</p>'; cont.hidden = false; return }

  $('#portada').hidden = true
  cont.hidden = false
  cont.innerHTML = d.versions.map((v) => fitxaHTML(d, v)).join('') + historicHTML(d)
  muntarCalculadores(d)
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function fitxaHTML(d, v) {
  const esArea = v.familia === 'area'
  const xips = [
    v.classificacio ? `<span class="xip">${esc(v.classificacio)}</span>` : '',
    v.superficie ? `<span class="xip">${mil(v.superficie)} m²</span>` : '',
    ...v.claus.map((c) => `<span class="xip xip-clau">${esc(c.clau)}</span>`),
  ].join('')

  const avis = v.revisar ? `<div class="avis"><p>Aquesta fitxa té dades pendents de comprovació
     (${esc(v.revisar)}). Contrasta-les al Comú abans de prendre cap decisió.</p></div>` : ''

  const dades = [
    ['Tipus', esArea ? "Àrea diferenciada en sòl no urbanitzable" : "Unitat d'actuació"],
    ['Superfície', v.superficie ? mil(v.superficie) + ' m²' : 'no consta'],
    ['Zona', v.zones.map((z) => `${esc(z.nom)} (${esc(z.clau)})`).join(', ') || '—'],
    ['Subzona', v.subzones.map((z) => `${esc(z.nom)} (${esc(z.clau)})`).join(', ') || '—'],
    ['Alçades', esc(v.alcades) || 'segons la subzona'],
    v.edificabilitat_max ? ['Edificabilitat màxima', mil(v.edificabilitat_max) + ' m² de sostre'] : null,
    v.sistema_ordenacio ? ["Sistema d'ordenació", esc(v.sistema_ordenacio)] : null,
    v.parcela_minima ? ['Parcel·la mínima', esc(v.parcela_minima) + ' m²'] : null,
  ].filter(Boolean)

  return `
  <div class="titol-ua">
    <button class="enrere" onclick="location.hash=''">← Nova consulta</button>
    <h2>${esc(d.nom)}</h2>
    <p class="subtitol">${esArea ? 'Àrea diferenciada' : "Unitat d'actuació"} · versió vigent ${esc(v.modificacio)}</p>
    <div class="tira"><span class="xip xip-vig">Vigent</span>${xips}</div>
  </div>
  ${avis}

  <div class="bloc">
    <h3>La teva fitxa</h3>
    ${v.descripcio ? `<p>${esc(v.descripcio)}</p>` : ''}
    <dl class="dades">${dades.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>
    ${v.usos ? `<p style="margin-top:1rem">${esc(v.usos)}</p>` : ''}
    ${v.gestio ? `<p><strong>Gestió:</strong> ${esc(v.gestio)}</p>` : ''}
    <p class="font">${fontBopa(v.font)}</p>
  </div>

  ${v.claus.length ? `<div class="bloc">
    <h3>Què diuen les teves claus</h3>
    ${v.claus.map(clauHTML).join('')}
  </div>` : ''}

  ${calculadoraHTML(v)}
  `
}

function clauHTML(c) {
  const p = c.parametres.filter((x) => x.n || (x.v && x.v.length < 220)).slice(0, 8)
  return `
  <div style="margin-bottom:1.5rem">
    <p style="margin-bottom:.5rem"><strong>${esc(c.clau)}</strong> — ${esc(c.denominacio)}
       <span class="meta" style="color:var(--suau);font-size:.85rem"> · ${esc(c.tipus)}</span></p>
    ${c.subdivisions.length ? `<p style="font-size:.92rem;color:var(--suau)">Es desglossa en:
       ${c.subdivisions.map((s) => `${esc(s.codi)} ${esc(s.nom)}`).join(', ')}</p>` : ''}
    ${p.length ? `<dl class="dades">${p.map((x) =>
      `<dt>${esc(x.p)}</dt><dd>${x.n ? esc(x.n) + ' ' + esc(x.u || '') : esc(x.v)}</dd>`).join('')}</dl>` : ''}
    <p class="font">Normes urbanístiques, ${esc(c.article)}</p>
  </div>`
}

function calculadoraHTML(v) {
  if (v.familia === 'area') return `
    <div class="bloc">
      <h3>Es pot edificar?</h3>
      <p>Les àrees diferenciades en sòl no urbanitzable no tenen aprofitament privat.
         Si el Govern modifica la consideració d'afectació, l'àrea s'integra a la unitat
         d'actuació del mateix nom amb les seves condicions.</p>
      <p class="font">Normes urbanístiques, article 8</p>
    </div>`

  const potCalcular = v.coeficient || v.edificabilitat_max
  return `
  <div class="bloc">
    <h3>Calcula per a la teva parcel·la</h3>
    ${v.edificabilitat_max
      ? `<p>Aquesta unitat té l'edificabilitat assignada directament a la fitxa:
           <strong>${mil(v.edificabilitat_max)} m² de sostre</strong> per al conjunt de la unitat.</p>`
      : potCalcular
      ? `<p>La zona determina quant pots edificar; la subzona, com. El coeficient s'aplica sobre
           la <strong>parcel·la neta</strong>: la superfície un cop descomptats els vials i els cursos d'aigua.</p>`
      : `<p>Aquesta unitat no té coeficient d'edificabilitat: el volum edificable el determina la
           fitxa i els límits d'alçada. Consulta-ho al Comú.</p>`}

    <div class="calc-camps">
      <div>
        <label for="sup">Superfície de la parcel·la (m²)</label>
        <input type="text" id="sup" inputmode="numeric" placeholder="480">
      </div>
      <div>
        <label for="neta">Aquesta xifra…</label>
        <select id="neta">
          <option value="1">ja descompta vials i cursos d'aigua</option>
          <option value="0">és la superfície total</option>
        </select>
      </div>
    </div>

    <div id="sortida"></div>

    <div class="opcions">
      <label><input type="checkbox" id="bonif"> Es destina a habitatge, aparcament o ús agrícola o ramader
        (bonificació del 90% de l'impost)</label>
    </div>

    <div class="avis">
      <p><strong>Càlcul estimatiu.</strong> No té valor de llicència ni de liquidació.
         L'aprofitament i els imports definitius resulten de la resolució de la sol·licitud.
         La cessió urbanística no es calcula aquí: consulta-la al Comú.</p>
    </div>
    <p class="font">Coeficient: Normes urbanístiques, ${esc(v.article_coef || 'articles 62 a 66')} ·
       Parcel·la neta: article 18.1 · Impost sobre la construcció: ordinació tributària, article 59</p>
  </div>`
}

function muntarCalculadores(d) {
  const sup = $('#sup'), neta = $('#neta'), bonif = $('#bonif'), out = $('#sortida')
  if (!sup) return
  const v = d.versions.find((x) => x.familia !== 'area') || d.versions[0]
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
    <p class="com">${mil(sostre)} m² × ${String(imp.index_localitzacio).replace('.', ',')} × ${String(imp.tipus).replace('.', ',')} €/m²${bonificat ? `, amb la bonificació del 90% aplicada sobre ${eur(quota)}` : ''}</p>
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
    <p class="font">Preval sempre la darrera modificació. Les versions anteriors es conserven a efectes de consulta.</p>
  </div>`
}

async function pagina(nom) {
  const cont = $('#pagina')
  $('#portada').hidden = true; cont.hidden = false
  if (nom === 'glossari') {
    const g = await fetch('data/glossari.json').then((r) => r.json())
    cont.innerHTML = `<div class="bloc"><h3>Glossari</h3>${g.map((t) => `
      <div style="margin-bottom:1.5rem">
        <p style="margin-bottom:.3rem"><strong>${esc(t.terme)}</strong></p>
        <p>${esc(t.definicio_planera)}</p>
        <p class="font">${esc(t.font)}${t.article ? ', ' + esc(t.article) : ''}</p>
      </div>`).join('')}</div>`
  } else if (nom === 'claus') {
    const c = await fetch('data/claus.json').then((r) => r.json())
    cont.innerHTML = `<div class="bloc"><h3>Claus urbanístiques</h3>
      <dl class="dades">${c.map((x) => `<dt class="xip-clau">${esc(x.clau)}</dt>
        <dd>${esc(x.denominacio)}${x.coef_edificabilitat ? ` · coeficient ${esc(x.coef_edificabilitat)} m² sostre/m² sòl` : ''}
        <span class="meta" style="color:var(--suau);font-size:.85rem"><br>${esc(x.article)}</span></dd>`).join('')}</dl></div>`
  } else if (nom === 'preguntes') {
    const r = await fetch('data/regles.json').then((res) => res.json())
    cont.innerHTML = `<div class="bloc"><h3>Preguntes freqüents</h3>${r
      .filter((x) => x.estat !== 'NO CALCULABLE' && x.nom && !x.id_regla.startsWith('PARAM'))
      .map((x) => `<div style="margin-bottom:1.4rem">
        <p style="margin-bottom:.3rem"><strong>${esc(x.nom)}</strong></p>
        <p>${esc(x.formula)}</p>
        ${x.observacions ? `<p style="font-size:.93rem;color:var(--suau)">${esc(x.observacions)}</p>` : ''}
        <p class="font">${esc(x.font)}, ${esc(x.article)}</p></div>`).join('')}</div>`
  }
  cont.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

inici()
