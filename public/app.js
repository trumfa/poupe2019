const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const norm = (s) => (s || '').replace(/[’‘]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/·/g, '').toLowerCase().trim()
const mil = (n) => n == null ? '—' : n.toLocaleString('ca-ES', { maximumFractionDigits: 0 })
const eur = (n) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const paraf = (t) => esc(t).replace(/(?<=\.)\s+(?=[A-ZÀ-Ú])/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')

// Primera frase literal del text. No és un resum: és el text tal com està publicat.
function entrada(t, max = 260) {
  const s = String(t || '').trim()
  const tall = s.slice(0, max)
  const punt = tall.lastIndexOf('. ')
  return punt > 60 ? tall.slice(0, punt + 1) : (s.length > max ? tall + '…' : s)
}

let INDEX = [], CADASTRE = {}, CONFIG = {}, GENERALS = null, ARTICLES = null

async function inici() {
  const [idx, cfg] = await Promise.all([
    fetch('data/index.json').then((r) => r.json()),
    fetch('data/config.json').then((r) => r.json()).catch(() => ({})),
  ])
  INDEX = idx; CONFIG = cfg
  CADASTRE = await fetch('data/cadastre.json').then((r) => r.json()).catch(() => ({}))

  if (cfg.generat) $('#generat').textContent = `Dades actualitzades el ${cfg.generat}. ${INDEX.length} unitats.`
  $('#tria').innerHTML = '<option value="">Selecciona una unitat d\'actuació…</option>' +
    INDEX.map((u) => `<option value="${esc(u.id)}">${esc(u.nom)}</option>`).join('')
  $('#tria').addEventListener('change', (e) => { if (e.target.value) location.hash = 'ua/' + e.target.value })
  $('#q').addEventListener('input', cercar)

  $('#hamb').addEventListener('click', () => {
    const m = $('#menu'), obert = !m.hidden
    m.hidden = obert; $('#hamb').setAttribute('aria-expanded', String(!obert))
    $('#hamb').classList.toggle('obert', !obert)
  })
  $('#menu').addEventListener('click', () => { $('#menu').hidden = true; $('#hamb').classList.remove('obert') })
  $('#calaix-tanca').addEventListener('click', tancaCalaix)
  $('#calaix-fons').addEventListener('click', tancaCalaix)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tancaCalaix() })

  window.addEventListener('hashchange', ruta)
  ruta()
}

// ---------- calaix lateral amb el text dels articles ----------
async function obreArticle(nu) {
  if (!ARTICLES) ARTICLES = await fetch('data/articles.json').then((r) => r.json()).catch(() => ({}))
  const a = ARTICLES[nu]
  if (!a) return
  $('#calaix-titol').textContent = `Article ${a.num} · ${a.titol}`
  $('#calaix-cos').innerHTML = a.apartats.map((x) => `
    <p class="ap-num">${esc(a.num)}.${esc(x.apartat)}${x.claus?.length
      ? ` <span class="xip xip-clau">${x.claus.map(esc).join(' ')}</span>` : ''}</p>
    ${paraf(x.text)}`).join('') +
    `<p class="font">POUPE Vol. II — Normes urbanístiques (Modificació 04) ·
      BOPA núm. 135, 12/11/2025</p>`
  $('#calaix').hidden = false; $('#calaix-fons').hidden = false
  document.body.classList.add('bloquejat')
  $('#calaix-cos').scrollTop = 0
}
function tancaCalaix() {
  $('#calaix').hidden = true; $('#calaix-fons').hidden = true
  document.body.classList.remove('bloquejat')
}
const btnArt = (n, txt) => `<button class="btn btn-art" data-art="${esc(n)}">${txt || 'Article ' + esc(n)}</button>`

function lligaBotons(cont) {
  cont.querySelectorAll('[data-art]').forEach((b) =>
    b.addEventListener('click', () => obreArticle(b.dataset.art)))
  cont.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.scroll)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.open = true }
    }))
}

// ---------- cerca ----------
function cercar() {
  const q = norm($('#q').value)
  const llista = $('#resultats')
  if (q.length < 2) { llista.innerHTML = ''; return }
  const perCad = CADASTRE[$('#q').value.trim().toUpperCase()] || CADASTRE[$('#q').value.trim()]
  const ids = perCad ? [].concat(perCad) : null
  const trobats = (ids ? INDEX.filter((u) => ids.includes(u.id)) : INDEX.filter((u) => u.norm.includes(q))).slice(0, 10)
  llista.innerHTML = trobats.length
    ? trobats.map((u) => `<li><button data-id="${esc(u.id)}"><span>${esc(u.nom)}</span>
        <span class="meta">${esc(u.classificacio)}</span></button></li>`).join('')
    : `<li class="buit">Cap unitat amb aquest nom. Prova amb una part del nom, o consulta al Comú.</li>`
  llista.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { location.hash = 'ua/' + b.dataset.id }))
}

function ruta() {
  const h = location.hash.slice(1)
  $('#detall').hidden = true; $('#pagina').hidden = true; $('#cerca').hidden = false
  tancaCalaix()
  if (h.startsWith('ua/')) mostrarUA(h.slice(3))
  else if (h) pagina(h)
  else { $('#q').value = ''; $('#resultats').innerHTML = ''; $('#tria').value = ''; window.scrollTo(0, 0) }
}

// ---------- fitxa d'una unitat ----------
async function mostrarUA(id) {
  const [d] = await Promise.all([
    fetch(`data/ua/${id}.json`).then((r) => r.json()).catch(() => null),
    GENERALS ? Promise.resolve() : fetch('data/apartats-generals.json')
      .then((r) => r.json()).then((g) => { GENERALS = g }).catch(() => { GENERALS = [] }),
  ])
  const cont = $('#detall')
  if (!d) { cont.innerHTML = '<div class="cont"><p class="buit">No s\'ha trobat aquesta unitat.</p></div>'; cont.hidden = false; return }

  $('#cerca').hidden = true
  cont.hidden = false
  const v = d.versions.find((x) => x.familia !== 'area') || d.versions[0]

  cont.innerHTML = `<div class="cont">
    ${capcaleraHTML(d, v)}
    ${avisosHTML(d, v)}
    ${fitxaHTML(d, v)}
    ${calculadoraHTML(v)}
    ${patrimoniHTML(d)}
    ${condicionsHTML(v)}
    ${clausHTML(v)}
    ${d.versions.filter((x) => x !== v).map((x) => altraVersioHTML(d, x)).join('')}
    ${historicHTML(d)}
  </div>`

  muntarCalculadora(v)
  lligaBotons(cont)
  window.scrollTo(0, 0)
}

function capcaleraHTML(d, v) {
  const esArea = v.familia === 'area'
  return `
  <div class="titol-ua">
    <p class="molla"><a href="#">Consulta</a> · ${esc(esArea ? 'Àrea diferenciada' : "Unitat d'actuació")}</p>
    <h1>${esc(d.nom)}</h1>
    <div class="tira">
      <span class="xip xip-vig">Vigent ${esc(v.modificacio)}</span>
      ${v.classificacio ? `<span class="xip">${esc(v.classificacio)}</span>` : ''}
      ${v.superficie ? `<span class="xip">${mil(v.superficie)} m²</span>` : ''}
      ${v.claus.map((c) => `<span class="xip xip-clau" title="${esc(c.denominacio)}">${esc(c.clau)}</span>`).join('')}
    </div>
  </div>`
}

function avisosHTML(d, v) {
  let h = ''
  if (d.proteccions?.length) h += `<div class="nota">
    <p><strong>Patrimoni protegit.</strong> Hi ha ${d.proteccions.length}
    bé${d.proteccions.length > 1 ? 'ns' : ''} amb protecció en aquest àmbit.</p>
    <button class="btn btn-petit" data-scroll="patrimoni">Veure quins</button></div>`
  if (v.revisar) h += `<div class="nota nota-avis">
    <p><strong>Dada pendent de comprovació:</strong> ${esc(v.revisar)}. Contrasta-la al Comú.</p></div>`
  return h
}

function fitxaHTML(d, v) {
  const files = []
  if (v.superficie) files.push(['Superfície de la unitat', mil(v.superficie) + ' m²'])
  files.push(['Classificació del sòl', esc(v.classificacio) || '—'])
  files.push(['Zona', v.zones.map((z) => `${esc(z.nom)} (${esc(z.clau)})`).join(', ') || '—'])
  files.push(['Subzona', v.subzones.map((z) => `${esc(z.nom)} (${esc(z.clau)})`).join(', ') || '—'])
  if (v.edificabilitat_max) files.push(['Edificabilitat màxima', mil(v.edificabilitat_max) + ' m² de sostre'])
  else if (v.coeficient) files.push(["Coeficient d'edificabilitat",
    String(v.coeficient).replace('.', ',') + ' m² sostre per m² de parcel·la neta'])
  if (v.alcades) files.push(['Alçades', esc(v.alcades).replace(/;/g, '<br>')])
  if (v.parcela_minima) files.push(['Parcel·la mínima', esc(v.parcela_minima) + ' m²'])
  if (v.sistema_ordenacio) files.push(["Sistema d'ordenació", esc(v.sistema_ordenacio)])
  if (v.gestio) files.push(['Gestió', esc(entrada(v.gestio, 180))])

  const pdf = v.font.drive_id
    ? `<a class="btn" href="https://drive.google.com/file/d/${v.font.drive_id}/view"
         target="_blank" rel="noopener">Obrir la fitxa oficial (PDF)</a>` : ''

  return `
  <section class="bloc">
    <h2>Fitxa urbanística</h2>
    ${v.planol ? `<figure class="planol">
      <img src="https://drive.google.com/thumbnail?id=${esc(v.planol)}&sz=w1200"
           alt="Plànol de la fitxa" loading="lazy">
      <figcaption>Plànol de la fitxa. Per a la delimitació exacta, consulta els plànols d'ordenació.</figcaption>
    </figure>` : ''}
    <dl class="dades">${files.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>
    ${v.usos ? `<p class="usos">${esc(v.usos)}</p>` : ''}
    <div class="botons">${pdf}</div>
    <p class="font">${esc(v.font.volum)} · BOPA núm. ${esc(v.font.bopa_num)}, ${esc(v.font.bopa_data)}, pàg. ${esc(v.font.bopa_pagina)}</p>
  </section>`
}

function calculadoraHTML(v) {
  if (v.familia === 'area') return `
    <section class="bloc"><h2>Es pot edificar?</h2>
      <p>Les àrees diferenciades en sòl no urbanitzable no tenen aprofitament privat. Si el Govern
         modifica la consideració d'afectació, l'àrea s'integra a la unitat d'actuació del mateix nom.</p>
      <div class="botons">${btnArt(8, 'Article 8 · Àrees diferenciades')}</div></section>`

  if (!v.coeficient && !v.edificabilitat_max) return `
    <section class="bloc"><h2>Quant es pot edificar</h2>
      <p>Aquesta unitat no té coeficient d'edificabilitat: el volum edificable el determinen la
         fitxa i els límits d'alçada. Consulta-ho al Comú.</p></section>`

  return `
  <section class="bloc">
    <h2>Calcula per a la teva parcel·la</h2>
    ${v.edificabilitat_max
      ? `<p>Aquesta unitat té l'edificabilitat assignada a la fitxa: <strong>${mil(v.edificabilitat_max)} m² de sostre</strong> per al conjunt de la unitat.</p>`
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
    <label class="check"><input type="checkbox" id="bonif"> Es destina a habitatge, aparcament o
      ús agrícola o ramader (bonificació del 90% de l'impost)</label>
    <div class="nota nota-avis"><p><strong>Càlcul estimatiu.</strong> No té valor de llicència ni
      de liquidació. Els imports definitius resulten de la resolució de la sol·licitud. La cessió
      urbanística no es calcula aquí.</p></div>
    <div class="botons">${btnArt(18, 'Article 18 · Parcel·les')}</div>
    <p class="font">Coeficient: Normes urbanístiques, ${esc(v.article_coef || 'articles 62 a 66')} ·
       Impost sobre la construcció: ordinació tributària, article 59</p>
  </section>`
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
        <p class="com">El coeficient s'aplica sobre la parcel·la neta. Descompta la part de vials
        i cursos d'aigua, o consulta-la al Comú.</p></div>`
      return
    }
    let html = ''
    if (v.coeficient) {
      const sostre = Math.round(brut * v.coeficient)
      html += `<div class="resultat"><p class="etiqueta">Sostre màxim estimat</p>
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
  return `<div class="resultat"><p class="etiqueta">Impost sobre la construcció, estimat</p>
    <p class="xifra">${eur(final)}</p>
    <p class="com">${mil(sostre)} m² × ${String(imp.index_localitzacio).replace('.', ',')} × ${String(imp.tipus).replace('.', ',')} €/m²${bonificat ? `, amb la bonificació del 90% sobre ${eur(quota)}` : ''}</p></div>`
}

function patrimoniHTML(d) {
  if (!d.proteccions?.length) return ''
  const cats = [...new Set(d.proteccions.map((p) => p.categoria))]
  return `
  <section class="bloc" id="patrimoni">
    <h2>Patrimoni protegit</h2>
    <p>Aquest àmbit té béns o espais catalogats. Segons la categoria, això comporta obligacions
       abans de projectar cap actuació.</p>
    ${cats.map((c) => {
      const items = d.proteccions.filter((p) => p.categoria === c)
      return `<div class="cat-prot">
        <p class="cat">${esc(c)}</p>
        ${items[0].obligacio ? `<p class="obligacio">${esc(items[0].obligacio)}</p>` : ''}
        <div class="botons">${items.map((p, i) =>
          `<details class="be"><summary>${esc(p.nom)}</summary>
            <div class="be-cos"><dl class="dades">
              <dt>Categoria</dt><dd>${esc(p.categoria)}${p.tipus ? ' · ' + esc(p.tipus) : ''}</dd>
              <dt>Adreça</dt><dd>${esc(p.adreca || '—')}</dd>
            </dl></div></details>`).join('')}</div>
        <div class="botons">${btnArt(83, 'Article 83 · Béns culturals parroquials')}
          ${btnArt(84, 'Article 84 · BIC i espais de presumpció arqueològica')}</div>
      </div>`
    }).join('')}
    <p class="font">POUPE Vol. IX — Catàleg comunal d'edificis, espais i elements d'interès
       històric, monumental i cultural · BOPA núm. 62, 2/6/2021</p>
  </section>`
}

function condicionsHTML(v) {
  const meus = v.apartats || []
  const temes = (CONFIG.temes || []).filter((t) =>
    meus.some((a) => a.tema === t) || (GENERALS || []).some((a) => a.tema === t))
  if (!temes.length) return ''

  return `
  <section class="bloc">
    <h2>Condicions constructives</h2>
    <p>Les regles de les Normes urbanístiques que anomenen expressament les teves claus. La resta
       de condicions s'apliquen a tothom i les tens a l'article complet.</p>
    ${temes.map((t) => {
      const propis = meus.filter((a) => a.tema === t)
      const gen = (GENERALS || []).filter((a) => a.tema === t)
      const arts = [...new Set([...propis, ...gen].map((a) => a.num))].sort((a, b) => a - b)
      return `
      <div class="tema">
        <p class="cat">${esc(t[0].toUpperCase() + t.slice(1))}</p>
        ${propis.length ? propis.map((a) => `
          <div class="apartat">
            <p class="ap-num">${esc(a.article)}.${esc(a.apartat)}
              <span class="xip xip-clau">${a.claus.map(esc).join(' ')}</span></p>
            <p>${esc(entrada(a.text))}</p>
            <div class="botons">${btnArt(a.num, 'Veure l\'article sencer')}</div>
          </div>`).join('')
          : `<p class="meta">Cap regla específica per a les teves claus.</p>`}
        ${gen.length ? `<p class="meta">${gen.length} condicion${gen.length > 1 ? 's' : ''} més
          d'aplicació general.</p>
          <div class="botons">${arts.map((n) => btnArt(n)).join('')}</div>` : ''}
      </div>`
    }).join('')}
    <p class="font">POUPE Vol. II — Normes urbanístiques (Modificació 04) · BOPA núm. 135,
       12/11/2025. Els apartats es mostren segons les claus que el seu text anomena expressament.</p>
  </section>`
}

function clausHTML(v) {
  if (!v.claus.length) return ''
  return `
  <section class="bloc">
    <h2>Les teves claus</h2>
    ${v.claus.map((c) => {
      const amb = c.parametres.filter((x) => x.n || (x.v && !/^Apartat/i.test(x.p)))
      return `<div class="clau">
        <p class="cat"><span class="xip xip-clau">${esc(c.clau)}</span> ${esc(c.denominacio || 'clau no definida')}
          <span class="meta">· ${esc(c.tipus)}</span></p>
        ${c.coeficient ? `<p>Coeficient màxim d'edificabilitat: <strong>${esc(c.coeficient)} m² sostre/m² sòl</strong>.</p>` : ''}
        ${c.subdivisions.length ? `<p class="meta">Es desglossa en ${c.subdivisions.map((s) =>
          `${esc(s.codi)} ${esc(s.nom)}`).join(', ')}.</p>` : ''}
        ${amb.length ? `<dl class="dades">${amb.map((x) => `
          <dt>${esc(x.p)}</dt>
          <dd>${x.n ? `<strong>${esc(x.n)} ${esc(x.u || '')}</strong>` : esc(entrada(x.v, 200))}
            ${x.remet?.length ? `<div class="botons">${x.remet.map((n) => btnArt(n)).join('')}</div>` : ''}</dd>`).join('')}</dl>`
          : '<p class="meta">Aquesta clau no fixa paràmetres numèrics propis.</p>'}
        <div class="botons">${c.article ? btnArt(String(c.article).replace(/\D/g, ''), 'Article complet de la clau') : ''}</div>
      </div>`
    }).join('')}
  </section>`
}

function altraVersioHTML(d, v) {
  return `
  <section class="bloc">
    <h2>Àrea diferenciada amb el mateix nom</h2>
    <p>${esc(d.nom)} consta també com a àrea diferenciada en sòl no urbanitzable${v.superficie ? `, de ${mil(v.superficie)} m²` : ''}.
       És un àmbit diferent, amb el seu propi règim.</p>
    ${v.descripcio ? `<p>${esc(entrada(v.descripcio, 320))}</p>` : ''}
    <div class="botons">${v.font.drive_id
      ? `<a class="btn" href="https://drive.google.com/file/d/${v.font.drive_id}/view" target="_blank" rel="noopener">Obrir la fitxa (PDF)</a>` : ''}</div>
  </section>`
}

function historicHTML(d) {
  if (d.historic.length < 2) return ''
  return `
  <section class="bloc">
    <h2>Històric de modificacions</h2>
    <p class="meta">Preval sempre la darrera modificació. Les anteriors es conserven a efectes de consulta.</p>
    <ul class="hist">
      ${d.historic.map((h) => `<li>
        <div><strong>${esc(h.modificacio)}</strong>${h.vigent ? ' · vigent' : ''}
          <span class="meta"><br>${esc(h.fase || '')} · BOPA núm. ${esc(h.bopa_num)}, ${esc(h.bopa_data)}</span></div>
        ${h.drive_id ? `<a class="btn btn-petit" href="https://drive.google.com/file/d/${h.drive_id}/view" target="_blank" rel="noopener">PDF</a>` : ''}
      </li>`).join('')}
    </ul>
  </section>`
}

// ---------- pàgines generals ----------
async function pagina(nom) {
  const cont = $('#pagina')
  $('#cerca').hidden = true; cont.hidden = false
  let h = ''
  if (nom === 'glossari') {
    const g = await fetch('data/glossari.json').then((r) => r.json())
    h = `<h1>Glossari</h1>${g.map((t) => `<div class="terme">
      <p class="cat">${esc(t.terme)}</p><p>${esc(t.definicio_planera)}</p>
      <p class="font">${esc(t.font)}${t.article ? ', ' + esc(t.article) : ''}</p></div>`).join('')}`
  } else if (nom === 'claus') {
    const c = await fetch('data/claus.json').then((r) => r.json())
    h = `<h1>Claus urbanístiques</h1><dl class="dades">${c.map((x) => `
      <dt class="xip-clau">${esc(x.clau)}</dt>
      <dd>${esc(x.denominacio)}${x.coef_edificabilitat ? ` · coeficient ${esc(x.coef_edificabilitat)}` : ''}
        <div class="botons">${btnArt(String(x.article).replace(/\D/g, ''))}</div></dd>`).join('')}</dl>`
  } else if (nom === 'normativa') {
    if (!ARTICLES) ARTICLES = await fetch('data/articles.json').then((r) => r.json())
    const nums = Object.keys(ARTICLES).map(Number).sort((a, b) => a - b)
    h = `<h1>Normes urbanístiques</h1>
      <p class="entrada">POUPE Volum II, Modificació 04. Publicades al BOPA núm. 135 de 12/11/2025.</p>
      <ul class="llista-art">${nums.map((n) => `<li>
        <span><strong>Article ${n}</strong> · ${esc(ARTICLES[n].titol)}</span>
        ${btnArt(n, 'Obrir')}</li>`).join('')}</ul>`
  } else if (nom === 'preguntes') {
    const r = await fetch('data/regles.json').then((res) => res.json())
    h = `<h1>Preguntes freqüents</h1>${r
      .filter((x) => x.estat !== 'NO CALCULABLE' && x.nom && !String(x.id_regla).startsWith('PARAM'))
      .map((x) => `<div class="terme"><p class="cat">${esc(x.nom)}</p><p>${esc(x.formula)}</p>
        ${x.observacions ? `<p class="meta">${esc(x.observacions)}</p>` : ''}
        <p class="font">${esc(x.font)}, ${esc(x.article)}</p></div>`).join('')}`
  }
  cont.innerHTML = `<div class="cont">${h}</div>`
  lligaBotons(cont)
  window.scrollTo(0, 0)
}

inici()
