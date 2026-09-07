const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const norm = (s) => (s || '').replace(/[’‘]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/·/g, '').toLowerCase().trim()
const mil = (n) => n == null ? '—' : n.toLocaleString('ca-ES', { maximumFractionDigits: 0 })
const eur = (n) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Majúscula inicial i neteja de restes de numeració.
const maj = (s) => {
  const t = String(s || '').trim().replace(/^[a-z]\)\s*/, '').replace(/^\d{1,2}\.\s*/, '')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}
const paraf = (t) => maj(esc(t)).replace(/(?<=\.)\s+(?=[A-ZÀ-Ú])/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')

// Primera frase literal. No és un resum: és el text tal com està publicat.
function entrada(t, max = 240) {
  const s = maj(t)
  if (s.length <= max) return s
  const tall = s.slice(0, max)
  const punt = tall.lastIndexOf('. ')
  return punt > 60 ? tall.slice(0, punt + 1) : tall.replace(/\s\S*$/, '…')
}

// Grups temàtics: agrupen els temes de les Normes en blocs comprensibles.
const GRUPS = [
  { nom: 'La parcel·la', temes: ['parcel·la i separacions', 'dimensions', 'superfícies'] },
  { nom: 'Alçades i volums', temes: ['alçades', 'volums i cossos volats'] },
  { nom: "Acabats de l'edifici", temes: ['cobertes', 'façanes i acabats', 'obertures'] },
  { nom: 'Moviments de terra', temes: ['moviments de terra'] },
  { nom: 'Usos, aparcament i altres', temes: ['usos', 'aparcament', 'construcció i habitabilitat', 'edificacions auxiliars', 'obres provisionals'] },
]

let INDEX = [], CADASTRE = {}, CONFIG = {}, GENERALS = null, ARTICLES = null, CLAUS_ARA = []

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
  $('#calaix-tanca').addEventListener('click', () => tancaCalaix())
  $('#calaix-fons').addEventListener('click', () => tancaCalaix())
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tancaCalaix() })

  // Tancar arrossegant avall (mòbil)
  let y0 = null
  const cal = $('#calaix')
  cal.addEventListener('touchstart', (e) => {
    y0 = $('#calaix-cos').scrollTop <= 0 ? e.touches[0].clientY : null
  }, { passive: true })
  cal.addEventListener('touchmove', (e) => {
    if (y0 === null) return
    const dy = e.touches[0].clientY - y0
    if (dy > 0) cal.style.transform = `translateY(${dy}px)`
  }, { passive: true })
  cal.addEventListener('touchend', (e) => {
    if (y0 === null) return
    const dy = (e.changedTouches[0].clientY - y0)
    cal.style.transform = ''
    if (dy > 110) tancaCalaix()
    y0 = null
  })

  window.addEventListener('hashchange', ruta)
  window.addEventListener('popstate', () => { if (!$('#calaix').hidden) tancaCalaix(true) })
  ruta()
}

// ---------- calaix lateral / full inferior ----------
async function obreArticle(nu, sencer = false) {
  if (!ARTICLES) ARTICLES = await fetch('data/articles.json').then((r) => r.json()).catch(() => ({}))
  const a = ARTICLES[nu]
  if (!a) return
  const meus = new Set(CLAUS_ARA.map((c) => c.toUpperCase()))
  const aplica = (x) => !x.claus?.length || x.claus.some((c) => meus.has(c))
  const llista = sencer || !meus.size ? a.apartats : a.apartats.filter(aplica)
  const ocults = a.apartats.length - llista.length

  $('#calaix-titol').textContent = `Article ${a.num} · ${a.titol}`
  $('#calaix-cos').innerHTML =
    (ocults > 0 ? `<div class="nota"><p>Es mostren els ${llista.length} apartats aplicables a les
       teves claus. N'hi ha ${ocults} més que regulen altres claus.</p>
       <button class="btn btn-petit" data-sencer="${esc(nu)}">Veure l'article sencer</button></div>` : '') +
    llista.map((x) => `
      <p class="ap-num">${esc(a.num)}.${esc(x.apartat)}${x.claus?.length
        ? ` <span class="xip xip-clau">${x.claus.map(esc).join(' ')}</span>` : ''}</p>
      ${paraf(x.text)}`).join('') +
    `<p class="font">POUPE Vol. II — Normes urbanístiques (Modificació 04) · BOPA núm. 135, 12/11/2025</p>
     <div class="botons"><button class="btn btn-ple" id="tanca-baix">Tancar</button></div>`

  $('#calaix-cos').querySelectorAll('[data-sencer]').forEach((b) =>
    b.addEventListener('click', () => obreArticle(b.dataset.sencer, true)))
  $('#tanca-baix')?.addEventListener('click', () => tancaCalaix())

  $('#calaix').hidden = false; $('#calaix-fons').hidden = false
  document.body.classList.add('bloquejat')
  $('#calaix-cos').scrollTop = 0
  if (!history.state?.calaix) history.pushState({ calaix: true }, '')
}

function tancaCalaix(perHistorial) {
  if ($('#calaix').hidden) return
  $('#calaix').hidden = true; $('#calaix-fons').hidden = true
  $('#calaix').style.transform = ''
  document.body.classList.remove('bloquejat')
  if (!perHistorial && history.state?.calaix) history.back()
}

const btnArt = (n, txt) => n ? `<button class="btn" data-art="${esc(n)}">${txt || 'Article ' + esc(n)}</button>` : ''

function lligaBotons(cont) {
  cont.querySelectorAll('[data-art]').forEach((b) =>
    b.addEventListener('click', () => obreArticle(b.dataset.art)))
  cont.querySelectorAll('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.scroll)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.remove('ressaltat')
      void el.offsetWidth
      el.classList.add('ressaltat')
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
    : `<li class="buit">Cap unitat amb aquest nom. Prova amb una part del nom.</li>`
  llista.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { location.hash = 'ua/' + b.dataset.id }))
}

function ruta() {
  const h = location.hash.slice(1)
  $('#detall').hidden = true; $('#pagina').hidden = true; $('#cerca').hidden = false
  tancaCalaix(true)
  if (h.startsWith('ua/')) mostrarUA(h.slice(3))
  else if (h) pagina(h)
  else { $('#q').value = ''; $('#resultats').innerHTML = ''; $('#tria').value = ''; CLAUS_ARA = []; window.scrollTo(0, 0) }
}

// ---------- fitxa ----------
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
  CLAUS_ARA = v.claus.map((c) => c.clau)

  cont.innerHTML = `<div class="cont">
    ${capcaleraHTML(d, v)}
    ${avisosHTML(d, v)}
    ${fitxaHTML(v)}
    ${calculadoraHTML(v)}
    ${clausHTML(v)}
    ${condicionsHTML(v)}
    ${patrimoniHTML(d)}
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
  <header class="titol-ua">
    <p class="molla"><a href="#">Consulta</a> › ${esc(esArea ? 'Àrea diferenciada' : "Unitat d'actuació")}</p>
    <h1>${esc(d.nom)}</h1>
    <div class="tira">
      <span class="xip xip-vig">Vigent ${esc(v.modificacio)}</span>
      ${v.classificacio ? `<span class="xip">${esc(v.classificacio)}</span>` : ''}
      ${v.superficie ? `<span class="xip">${mil(v.superficie)} m²</span>` : ''}
      ${v.claus.map((c) => `<span class="xip xip-clau" title="${esc(c.denominacio)}">${esc(c.clau)}</span>`).join('')}
    </div>
  </header>`
}

function avisosHTML(d, v) {
  let h = ''
  if (d.proteccions?.length) {
    const p = d.proteccions
    const cats = [...new Set(p.map((x) => x.categoria))]
    h += `<div class="nota nota-prot">
      <p><strong>Patrimoni protegit.</strong> Aquest àmbit té ${p.length}
        bé${p.length > 1 ? 'ns' : ''} catalogat${p.length > 1 ? 's' : ''}.
        Abans de projectar cap actuació, comprova quines obligacions t'afecten.</p>
      <ul class="llista-prot">${p.slice(0, 6).map((x) =>
        `<li><strong>${esc(x.nom)}</strong>
          <span class="meta">${esc(maj(x.categoria.toLowerCase()))}${x.adreca ? ' · ' + esc(x.adreca) : ''}</span></li>`).join('')}
        ${p.length > 6 ? `<li class="meta">i ${p.length - 6} més</li>` : ''}</ul>
      <div class="botons"><button class="btn btn-petit" data-scroll="patrimoni">Quines obligacions comporta</button></div>
    </div>`
  }
  if (v.revisar) h += `<div class="nota nota-avis">
    <p><strong>Dada pendent de comprovació:</strong> ${esc(v.revisar)}. Contrasta-la amb la publicació oficial abans de fer-la servir.</p></div>`
  return h
}

function fitxaHTML(v) {
  const dada = (k, val) => val ? `<div class="dada"><span class="k">${k}</span><span class="val">${val}</span></div>` : ''
  const destacat = v.edificabilitat_max
    ? `<div class="destacat"><p class="k">Edificabilitat màxima de la unitat</p>
        <p class="xifra">${mil(v.edificabilitat_max)} m²</p><p class="com">de sostre</p></div>`
    : v.coeficient
    ? `<div class="destacat"><p class="k">Coeficient d'edificabilitat</p>
        <p class="xifra">${String(v.coeficient).replace('.', ',')}</p>
        <p class="com">m² de sostre per m² de parcel·la neta</p></div>` : ''

  return `
  <section class="bloc">
    <h2>Fitxa urbanística</h2>
    ${v.planol ? `<figure class="planol">
      <img src="https://drive.google.com/thumbnail?id=${esc(v.planol)}&sz=w1200" alt="Plànol de la fitxa" loading="lazy">
      <figcaption>Plànol de la fitxa. Per a la delimitació exacta, consulta els plànols d'ordenació.</figcaption></figure>` : ''}
    ${destacat}
    <div class="graella">
      ${dada('Superfície de la unitat', v.superficie ? mil(v.superficie) + ' m²' : '')}
      ${dada('Classificació del sòl', esc(v.classificacio))}
      ${dada('Zona', v.zones.map((z) => `${esc(z.nom)} <span class="xip xip-clau">${esc(z.clau)}</span>`).join(' '))}
      ${dada('Subzona', v.subzones.map((z) => `${esc(z.nom)} <span class="xip xip-clau">${esc(z.clau)}</span>`).join(' '))}
      ${dada('Alçades màximes', v.alcades ? maj(esc(v.alcades)).replace(/;/g, '<br>') : '')}
      ${dada('Parcel·la mínima', v.parcela_minima ? esc(v.parcela_minima) + ' m²' : '')}
      ${dada("Sistema d'ordenació", esc(v.sistema_ordenacio))}
    </div>
    ${v.usos ? `<p class="usos">${esc(maj(v.usos))}</p>` : ''}
    ${v.gestio ? `<p class="usos">${esc(entrada(v.gestio, 300))}</p>` : ''}
    <div class="botons">${v.font.drive_id
      ? `<a class="btn btn-ple" href="https://drive.google.com/file/d/${v.font.drive_id}/view" target="_blank" rel="noopener">Obrir la fitxa oficial (PDF)</a>` : ''}</div>
    <p class="font">${esc(v.font.volum)} · BOPA núm. ${esc(v.font.bopa_num)}, ${esc(v.font.bopa_data)}, pàg. ${esc(v.font.bopa_pagina)}</p>
  </section>`
}

function calculadoraHTML(v) {
  if (v.familia === 'area') return `
    <section class="bloc"><h2>Es pot edificar?</h2>
      <p>Les àrees diferenciades en sòl no urbanitzable no tenen aprofitament privat. Si el Govern
         modifica la consideració d'afectació, l'àrea s'integra a la unitat d'actuació del mateix nom.</p>
      <div class="botons">${btnArt(8, 'Article 8 · Àrees diferenciades')}</div></section>`
  if (!v.coeficient && !v.edificabilitat_max) return ''

  return `
  <section class="bloc">
    <h2>Calcula per a la teva parcel·la</h2>
    <p>El coeficient s'aplica sobre la <strong>parcel·la neta</strong>: la superfície un cop
       descomptats els vials i els cursos d'aigua.</p>
    <div class="calc-camps">
      <div><label for="sup">Superfície de la parcel·la (m²)</label>
        <input type="text" id="sup" inputmode="numeric" placeholder="480"></div>
      <div><label for="neta">Aquesta xifra…</label>
        <select id="neta"><option value="1">ja descompta vials i cursos d'aigua</option>
          <option value="0">és la superfície total</option></select></div>
    </div>
    <div id="sortida"></div>
    <label class="check"><input type="checkbox" id="bonif"> Es destina a habitatge, aparcament o
      ús agrícola o ramader (bonificació del 90% de l'impost)</label>
    <div class="nota nota-avis"><p><strong>Càlcul estimatiu.</strong> No té valor de llicència ni
      de liquidació. Els imports definitius resulten de la resolució de la sol·licitud davant l'administració competent.</p></div>
    <div class="botons">${btnArt(18, 'Article 18 · Parcel·les')}</div>
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
        i cursos d'aigua.</p></div>`
      return
    }
    let html = ''
    if (v.coeficient) {
      const sostre = Math.round(brut * v.coeficient)
      html += `<div class="resultat"><p class="etiqueta">Sostre màxim estimat</p>
        <p class="xifra">${mil(sostre)} m²</p>
        <p class="com">${mil(brut)} m² × ${String(v.coeficient).replace('.', ',')} m² sostre/m² sòl</p></div>`
      html += impostHTML(sostre, imp, bonif.checked)
    } else if (v.edificabilitat_max) html += impostHTML(v.edificabilitat_max, imp, bonif.checked)
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

function clausHTML(v) {
  if (!v.claus.length) return ''
  return `
  <section class="bloc">
    <h2>Les teves claus</h2>
    <p>La zona determina quant pots edificar; la subzona, com.</p>
    ${v.claus.map((c) => {
      const amb = c.parametres.filter((x) => x.v && !/^Apartat/i.test(x.p))
      return `<article class="targeta">
        <p class="targeta-cap"><span class="xip xip-clau">${esc(c.clau)}</span>
          <strong>${esc(c.denominacio || 'Clau no definida')}</strong>
          <span class="meta">${esc(c.tipus)}</span></p>
        ${c.coeficient ? `<p class="clau-coef">Coeficient màxim d'edificabilitat:
          <strong>${esc(c.coeficient)} m² sostre/m² sòl</strong></p>` : ''}
        ${c.subdivisions.length ? `<p class="meta">Es desglossa en ${c.subdivisions.map((s) =>
          `${esc(s.codi)} ${esc(s.nom)}`).join(', ')}.</p>` : ''}
        ${amb.length ? `<div class="graella">${amb.map((x) => `
          <div class="dada"><span class="k">${esc(maj(x.p))}</span>
            <span class="val">${x.n ? `<strong>${esc(x.n)} ${esc(x.u || '')}</strong>` : esc(entrada(x.v, 190))}
            ${x.remet?.length ? `<span class="botons">${x.remet.map((n) => btnArt(n)).join('')}</span>` : ''}</span></div>`).join('')}</div>`
          : '<p class="meta">Aquesta clau no fixa paràmetres numèrics propis.</p>'}
        <div class="botons">${btnArt(String(c.article).replace(/\D/g, ''), 'Article de la clau')}</div>
      </article>`
    }).join('')}
  </section>`
}

function condicionsHTML(v) {
  const meus = v.apartats || []
  const grups = GRUPS.map((g) => ({
    nom: g.nom,
    propis: meus.filter((a) => g.temes.includes(a.tema)),
    arts: [...new Set((GENERALS || []).filter((a) => g.temes.includes(a.tema)).map((a) => a.num))].sort((a, b) => a - b),
    gen: (GENERALS || []).filter((a) => g.temes.includes(a.tema)).length,
  })).filter((g) => g.propis.length || g.gen)
  if (!grups.length) return ''

  return `
  <section class="bloc">
    <h2>Condicions constructives</h2>
    <p>Les regles de les Normes urbanístiques que anomenen expressament les teves claus es mostren
       senceres. La resta són d'aplicació general.</p>
    ${grups.map((g) => `
      <div class="grup">
        <h3>${esc(g.nom)}</h3>
        ${g.propis.length ? g.propis.map((a) => `
          <article class="apartat">
            <p class="ap-num">${esc(a.article)}.${esc(a.apartat)} · ${esc(a.titol)}
              <span class="xip xip-clau">${a.claus.map(esc).join(' ')}</span></p>
            ${paraf(a.text)}
          </article>`).join('')
          : `<p class="meta">Cap regla específica per a les teves claus.</p>`}
        ${g.gen ? `<div class="general">
          <p class="meta">${g.gen} condicion${g.gen > 1 ? 's' : ''} d'aplicació general en aquest àmbit.</p>
          <div class="botons">${g.arts.map((n) => btnArt(n)).join('')}</div></div>` : ''}
      </div>`).join('')}
    <p class="font">POUPE Vol. II — Normes urbanístiques (Modificació 04) · BOPA núm. 135, 12/11/2025.
       Els apartats s'assignen segons les claus que el seu text anomena expressament.</p>
  </section>`
}

function patrimoniHTML(d) {
  if (!d.proteccions?.length) return ''
  const cats = [...new Set(d.proteccions.map((p) => p.categoria))]
  return `
  <section class="bloc" id="patrimoni">
    <h2>Patrimoni protegit</h2>
    ${cats.map((c) => {
      const items = d.proteccions.filter((p) => p.categoria === c)
      return `<div class="grup">
        <h3>${esc(maj(c.toLowerCase()))}</h3>
        ${items[0].obligacio ? `<p class="obligacio">${esc(maj(items[0].obligacio))}</p>` : ''}
        <div class="graella">${items.map((p) => `
          <div class="dada"><span class="k">${esc(maj((p.tipus || 'Bé').toLowerCase()))}</span>
            <span class="val">${esc(p.nom)}${p.adreca ? `<br><span class="meta">${esc(p.adreca)}</span>` : ''}</span></div>`).join('')}</div>
        <div class="botons">${btnArt(83, 'Article 83')} ${btnArt(84, 'Article 84')}</div>
      </div>`
    }).join('')}
    <p class="font">POUPE Vol. IX — Catàleg comunal d'edificis, espais i elements d'interès
       històric, monumental i cultural · BOPA núm. 62, 2/6/2021</p>
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
    <ul class="hist">${d.historic.map((h) => `<li>
      <div><strong>${esc(h.modificacio)}</strong>${h.vigent ? ' · vigent' : ''}
        <span class="meta"><br>${esc(h.fase || '')} · BOPA núm. ${esc(h.bopa_num)}, ${esc(h.bopa_data)}</span></div>
      ${h.drive_id ? `<a class="btn btn-petit" href="https://drive.google.com/file/d/${h.drive_id}/view" target="_blank" rel="noopener">PDF</a>` : ''}
    </li>`).join('')}</ul>
  </section>`
}

async function pagina(nom) {
  const cont = $('#pagina')
  $('#cerca').hidden = true; cont.hidden = false
  CLAUS_ARA = []
  let h = ''
  if (nom === 'glossari') {
    const g = await fetch('data/glossari.json').then((r) => r.json())
    h = `<h1>Glossari</h1>${g.map((t) => `<article class="targeta">
      <p class="targeta-cap"><strong>${esc(t.terme)}</strong></p><p>${esc(maj(t.definicio_planera))}</p>
      <p class="font">${esc(t.font)}${t.article ? ', ' + esc(t.article) : ''}</p></article>`).join('')}`
  } else if (nom === 'claus') {
    const c = await fetch('data/claus.json').then((r) => r.json())
    h = `<h1>Claus urbanístiques</h1><div class="graella">${c.map((x) => `
      <div class="dada"><span class="k"><span class="xip xip-clau">${esc(x.clau)}</span></span>
        <span class="val">${esc(x.denominacio)}${x.coef_edificabilitat ? ` · coeficient ${esc(x.coef_edificabilitat)}` : ''}
          <span class="botons">${btnArt(String(x.article).replace(/\D/g, ''))}</span></span></div>`).join('')}</div>`
  } else if (nom === 'normativa') {
    if (!ARTICLES) ARTICLES = await fetch('data/articles.json').then((r) => r.json())
    const nums = Object.keys(ARTICLES).map(Number).sort((a, b) => a - b)
    h = `<h1>Normes urbanístiques</h1>
      <p class="entrada">POUPE Volum II, Modificació 04. BOPA núm. 135 de 12/11/2025.</p>
      <ul class="llista-art">${nums.map((n) => `<li>
        <span><strong>Article ${n}</strong> · ${esc(ARTICLES[n].titol)}</span>${btnArt(n, 'Obrir')}</li>`).join('')}</ul>`
  } else if (nom === 'sobre') {
    h = `<h1>Sobre aquest projecte</h1>
      <p class="entrada">Aquesta web és un projecte de consulta del Pla d'Ordenació i Urbanisme de
         la Parròquia d'Encamp, revisió 2019. No és un servei oficial ni substitueix cap tràmit.</p>
      <article class="targeta"><p class="targeta-cap"><strong>D'on surt la informació</strong></p>
        <p>De les fitxes urbanístiques i les Normes urbanístiques publicades al Butlletí Oficial del
           Principat d'Andorra. Cada dada indica el volum, el número de butlletí, la data i la pàgina
           d'on prové, i des de cada fitxa es pot obrir el PDF original.</p></article>
      <article class="targeta"><p class="targeta-cap"><strong>Com s'ha construït</strong></p>
        <p>Les fitxes són imatges dins dels PDF publicats i s'han transcrit amb reconeixement òptic
           de caràcters. Les Normes urbanístiques sí que tenen text i s'han extret literalment. Les
           unitats amb dades que encara no s'han pogut comprovar es mostren amb un avís.</p></article>
      <article class="targeta"><p class="targeta-cap"><strong>Què no fa</strong></p>
        <p>No emet certificats ni resol consultes urbanístiques. Els càlculs d'edificabilitat i
           d'impost són orientatius: apliquen la norma publicada a una superfície introduïda per
           l'usuari, i el resultat definitiu depèn de la resolució de cada expedient. La cessió
           urbanística no es calcula.</p></article>
      <p class="font">En cas de discrepància preval sempre el text publicat al BOPA.</p>`
  } else if (nom === 'preguntes') {
    const r = await fetch('data/regles.json').then((res) => res.json())
    h = `<h1>Preguntes freqüents</h1>${r
      .filter((x) => x.estat !== 'NO CALCULABLE' && x.nom && !String(x.id_regla).startsWith('PARAM'))
      .map((x) => `<article class="targeta"><p class="targeta-cap"><strong>${esc(x.nom)}</strong></p>
        <p>${esc(maj(x.formula))}</p>${x.observacions ? `<p class="meta">${esc(x.observacions)}</p>` : ''}
        <p class="font">${esc(x.font)}, ${esc(x.article)}</p></article>`).join('')}`
  }
  cont.innerHTML = `<div class="cont">${h}</div>`
  lligaBotons(cont)
  window.scrollTo(0, 0)
}

window.tancaCalaix = tancaCalaix
inici()
