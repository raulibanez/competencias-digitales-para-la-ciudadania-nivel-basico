/* Simulacro del examen: imita la pantalla del examen de tuCertiCyL.
 *
 *  Parte 1 · Demo oficial: las 20 preguntas de la demo (JSON #sm-demo de index.html; archivos en demo/).
 *  Parte 2 · Simulacro largo: 3 preguntas por competencia (2 de conocimientos y 1 de habilidades). Se leen con fetch y
 *    DOMParser los «Comprueba» (.comprueba[data-comp]: 3 preguntas, la tercera es la de habilidades) y los tests de
 *    repaso (.repaso-test, cada pregunta con "comp") de ../tema1/ a ../tema5/. Se importan sus <template>, sus estilos
 *    con prefijo tN-, sus simulaciones (sim/*.js) y sus scripts propios (los <script> sin src, que amplían sus
 *    simulaciones HTML). Las preguntas de práctica (.preg-bloque, las de la demo) no entran.
 *
 *  Las preguntas se montan con CDC.TIPOS (assets/cdc.js) y no se corrigen al guardar: «Guardar» solo guarda la respuesta.
 *  Al finalizar se restaura la respuesta guardada de cada pregunta y se llama a su comprobar(), que además marca en
 *  verde la opción correcta para la revisión. Las simulaciones van en modoExamen (no enseñan la solución).
 *  El último resultado de cada parte se guarda en localStorage (clave cdc-simulacro).
 */
(function () {
  'use strict';
  const CDC = window.CDC;

  /* ---------- utilidades ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (s) => CDC.fmt(s || '').replace(/\n/g, '<br>');
  const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pct = (a, t) => (t ? Math.round(a / t * 100) : 0);
  const dos = (n) => String(n).padStart(2, '0');

  const ICO = {
    sim: '<svg class="sm-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.4 5v6l4.8-3z" fill="currentColor"/></svg>',
    reto: '<svg class="sm-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.4" y="2.2" width="13.2" height="8.8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.2 14.2h5.6M8 11v3.2" stroke="currentColor" stroke-width="1.5"/></svg>',
    estrella: '<svg class="sm-ico sm-estrella" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    'estrella-llena': '<svg class="sm-ico sm-estrella llena" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z" fill="currentColor" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    reloj: '<svg class="sm-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 13.5V9M9.5 2.5h5M12 2.5v2.8M18.6 6.4l1.6-1.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    ok: '<svg class="sm-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    descarga: '<svg class="sm-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4 15.5v4h16v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    barras: '<svg class="sm-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="4.5" height="10" rx="1"/><rect x="9.75" y="3" width="4.5" height="18" rx="1"/><rect x="16.5" y="8" width="4.5" height="13" rx="1"/></svg>',
  };

  const AREAS = {
    1: 'Búsqueda, evaluación y gestión de la información',
    2: 'Comunicación y colaboración',
    3: 'Creación de contenidos',
    4: 'Seguridad, bienestar y uso responsable',
    5: 'Resolución de problemas',
  };
  const ICONO_AREA = { 1: 'informacion', 2: 'comunicacion', 3: 'creacion', 4: 'seguridad', 5: 'problemas' };
  // Las 21 competencias de DigComp 2.2, con los nombres cortos que usa el curso
  const COMPS = {
    '1.1': 'Navegación, búsqueda y filtrado de información',
    '1.2': 'Evaluación de la información',
    '1.3': 'Gestión de la información',
    '2.1': 'Interactuar a través de tecnologías digitales',
    '2.2': 'Compartir a través de tecnologías digitales',
    '2.3': 'Participación ciudadana',
    '2.4': 'Colaborar a través de tecnologías digitales',
    '2.5': 'Comportamiento digital',
    '2.6': 'Gestión de la identidad digital',
    '3.1': 'Desarrollo de contenidos digitales',
    '3.2': 'Integración y reelaboración',
    '3.3': 'Derechos de autor y licencias',
    '3.4': 'Pensamiento computacional y programación',
    '4.1': 'Protección de dispositivos',
    '4.2': 'Protección de los datos personales y la privacidad',
    '4.3': 'Apoyo al bienestar',
    '4.4': 'Impacto medioambiental',
    '5.1': 'Identificar y resolver problemas técnicos',
    '5.2': 'Identificar necesidades y respuestas tecnológicas',
    '5.3': 'Soluciones creativas con tecnologías digitales',
    '5.4': 'Identificar necesidades de competencias digitales',
  };
  const TOTAL_LARGO = 63;
  const DURACION = 90 * 60 * 1000;
  const UMBRAL = 0.75;
  const CLAVE = 'cdc-simulacro';
  const PARTES = { demo: 'Parte 1 · Demo oficial', largo: 'Parte 2 · Simulacro largo' };

  // Instrucciones del examen (las de la demo) para las preguntas de los temas que no traen las suyas
  const INSTR = {
    test: 'Elige una única opción entre las opciones de respuesta siguientes.',
    testVarias: 'Selecciona todas las respuestas correctas. Puedes seleccionar una o varias opciones entre las opciones de respuesta.',
    imagenes: 'Pulsa sobre las siguientes imágenes que quieras seleccionar como tu respuesta. Puedes seleccionar una o varias opciones entre las opciones de respuesta.',
    imagenesUna: 'Pulsa sobre la imagen que quieras seleccionar como tu respuesta. Elige una única opción.',
    emparejar: 'Ordena los elementos de la segunda lista para emparejarlos con los elementos de la primera lista.',
    ordenar: 'Ordena los elementos de la lista.',
    reto: 'Para resolver el reto sigue las instrucciones del enunciado sin cerrar el navegador. Si has de navegar a una web, accede a ella en otra pestaña de tu navegador o utiliza otro navegador. Si hay un archivo adjunto, descárgalo para realizar el reto con el ordenador.',
    simulacion: 'Realiza la actividad en el simulador. No puedes utilizar atajos de teclado, salvo que el enunciado lo indique. ¡Recuerda que solo puedes equivocarte una vez al hacer clic!',
  };
  const AYUDA_MOVER = 'Arrastra los elementos o pulsa dos para cambiarlos de sitio.';

  const esSim = (q) => q.tipo === 'simulacion';
  const conOpciones = (q) => q.tipo === 'test' || (q.tipo === 'reto' && !!q.opciones);
  const esTexto = (q) => q.tipo === 'reto' && !q.opciones;
  const esMover = (q) => q.tipo === 'emparejar' || q.tipo === 'ordenar';
  const esMulti = (q) => (Array.isArray(q.correcta) && q.correcta.length > 1) || !!q.multiple;

  function instrucciones(q) {
    if (q.instrucciones) return q.instrucciones;
    if (q.tipo === 'test') return q.imagenes ? (esMulti(q) ? INSTR.imagenes : INSTR.imagenesUna) : (esMulti(q) ? INSTR.testVarias : INSTR.test);
    return INSTR[q.tipo] || '';
  }

  /* ---------- datos de la demo y simulaciones propias de la demo ---------- */
  const DEMO = JSON.parse($('#sm-demo').textContent);
  const DEMO_SIMS = {};
  DEMO.forEach((q) => { if (q.sim && CDC.sims[q.sim]) DEMO_SIMS[q.sim] = CDC.sims[q.sim]; });

  /* ---------- resultados guardados ---------- */
  function leeResultados() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; } }
  function guardaResultado(r) {
    try {
      const t = leeResultados();
      t[r.parte] = r;
      localStorage.setItem(CLAVE, JSON.stringify(t));
    } catch (e) { /* sin almacenamiento: el simulacro funciona igual */ }
  }

  /* ---------- vistas, avisos y ventanas ---------- */
  let examen = null;
  function muestra(id) {
    $$('.sm-vista').forEach((v) => { v.hidden = v.id !== id; });
    $('#sm-salir').hidden = id !== 'v-examen';
    if ($('.sm-toast')) $('.sm-toast').hidden = true;
    if (id === 'v-portada') { $('#sm-barra').textContent = 'Simulacro del examen'; pintaPortada(); }
    window.scrollTo(0, 0);
  }
  let toastT = null;
  function toast(txt) {
    let t = $('.sm-toast');
    if (!t) { t = el('div', 'sm-toast'); t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = txt;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 5000);
  }
  function cierraModal() { const m = $('#sm-modal'); m.hidden = true; m.innerHTML = ''; }
  // botones: [[texto, función, clase], …]
  function modal(titulo, html, botones, cerrable) {
    const m = $('#sm-modal');
    m.innerHTML = '';
    const caja = el('div', 'sm-modal-caja', '<h2 id="sm-modal-tit">' + titulo + '</h2><div class="sm-modal-texto">' + html + '</div>');
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-labelledby', 'sm-modal-tit');
    const fila = el('div', 'sm-modal-botones');
    botones.forEach(([txt, fn, cls]) => {
      const b = el('button', 'sm-btn' + (cls ? ' ' + cls : ''), txt);
      b.type = 'button';
      b.addEventListener('click', () => { cierraModal(); if (fn) fn(); });
      fila.appendChild(b);
    });
    caja.appendChild(fila);
    m.appendChild(caja);
    m.hidden = false;
    m.onkeydown = (e) => { if (e.key === 'Escape' && cerrable !== false) cierraModal(); };
    m.onclick = (e) => { if (e.target === m && cerrable !== false) cierraModal(); };
    fila.querySelector('button').focus();
  }

  /* ======================================================================
     PORTADA
     ====================================================================== */
  function pintaPortada() {
    const t = leeResultados();
    ['demo', 'largo'].forEach((p) => {
      const r = t[p], e = $('#sm-ultimo-' + p);
      if (!r) { e.textContent = 'Todavía no lo has hecho en este navegador.'; return; }
      const fecha = new Date(r.fecha).toLocaleDateString('es-ES');
      const nota = r.incompleto ? '<span class="sm-incompleto">incompleto</span>' : r.apto ? '<span class="sm-apto">Apto</span>' : '<span class="sm-noapto">No apto</span>';
      e.innerHTML = 'Último intento, ' + fecha + ': <b>' + r.aciertos + ' de ' + r.total + '</b> (' + r.pct + ' %) · ' + nota;
    });
  }

  /* ======================================================================
     PARTE 2: BANCO DE PREGUNTAS DE LOS TEMAS
     ====================================================================== */
  let BANCO = null;
  const esRelativa = (v) => !!v && !/^\s*(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(v);
  const urlCss = (css, base) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, c, u) => (esRelativa(u) ? 'url(' + c + base + u.trim() + c + ')' : m));

  // Plantillas de simulaciones HTML: las rutas relativas pasan a ser relativas al tema
  function importaPlantillas(doc, base) {
    doc.querySelectorAll('template[id]').forEach((t) => {
      if (document.getElementById(t.id)) return;
      const nueva = document.importNode(t, true);
      nueva.content.querySelectorAll('[src],[href],[poster]').forEach((e) => ['src', 'href', 'poster'].forEach((a) => {
        const v = e.getAttribute(a);
        if (esRelativa(v)) e.setAttribute(a, base + v);
      }));
      nueva.content.querySelectorAll('[style]').forEach((e) => e.setAttribute('style', urlCss(e.getAttribute('style'), base)));
      document.body.appendChild(nueva);
    });
  }
  // Estilos propios del tema: solo las reglas con clases o ids tN- (las que usan sus plantillas)
  function filtraReglas(reglas) {
    const out = [];
    for (const r of reglas) {
      if (r.selectorText !== undefined) { if (/[.#]t\d-/.test(r.selectorText)) out.push(r.cssText); }
      else if (r.conditionText !== undefined && r.cssRules) { const d = filtraReglas(r.cssRules); if (d.length) out.push('@media ' + r.conditionText + ' {' + d.join('\n') + '}'); }
      else if (r.name !== undefined && /^t\d-/.test(r.name)) out.push(r.cssText);
    }
    return out;
  }
  function importaEstilos(doc, n, base) {
    doc.querySelectorAll('style').forEach((st) => {
      let reglas;
      try { const h = new CSSStyleSheet(); h.replaceSync(st.textContent); reglas = filtraReglas(h.cssRules); } catch (e) { return; }
      if (!reglas.length) return;
      const s = document.createElement('style');
      s.dataset.tema = n;
      s.textContent = urlCss(reglas.join('\n'), base);
      document.head.appendChild(s);
    });
  }
  // Simulaciones de imagen del tema (sim/*.js). Se apunta qué ha registrado cada tema, por si dos usan el mismo id.
  async function cargaSims(doc, base) {
    const propias = {};
    for (const s of doc.querySelectorAll('script[src]')) {
      const src = s.getAttribute('src');
      if (!/^sim\//.test(src)) continue;
      const antes = Object.assign({}, CDC.sims);
      await new Promise((fin) => {
        const e = document.createElement('script');
        e.src = base + src;
        e.onload = fin; e.onerror = fin;
        document.body.appendChild(e);
      });
      Object.keys(CDC.sims).forEach((k) => { if (CDC.sims[k] !== antes[k]) propias[k] = CDC.sims[k]; });
    }
    return propias;
  }

  async function cargaBanco(informa) {
    if (BANCO) { BANCO.temas.forEach((t) => informa(t)); return BANCO; }
    const banco = {}, temas = [], avisos = [], vistas = new Set();
    const enunDemo = new Set(DEMO.map((q) => normaliza(q.enunciado)));
    for (const n of [1, 2, 3, 4, 5]) {
      const base = '../tema' + n + '/';
      const info = { n, ok: false, preguntas: 0, comps: new Set() };
      let html = null;
      try {
        // index.html explícito: un servidor local puede devolver el listado de la carpeta si el tema aún no existe
        const r = await fetch(base + 'index.html', { cache: 'no-cache' });
        if (r.ok) html = await r.text();
      } catch (e) { /* sin tema */ }
      const doc = html && new DOMParser().parseFromString(html, 'text/html');
      if (!doc || !doc.querySelector('deck-stage, .comprueba, .repaso-test')) { temas.push(info); informa(info); continue; }
      info.ok = true;
      importaEstilos(doc, n, base);
      importaPlantillas(doc, base);
      const sims = await cargaSims(doc, base);
      ejecutaScripts(doc, n);
      const anade = (comp, q, clase, b) => {
        comp = String(comp || '').trim();
        if (!COMPS[comp]) { avisos.push('Tema ' + n + ': hay una pregunta sin competencia válida («' + esc(String(q.enunciado || '').slice(0, 60)) + '…»).'); return; }
        if (!q || !CDC.TIPOS[q.tipo] || !q.enunciado) return;
        if (q.tipo === 'simulacion' && q.sim && !sims[q.sim] && !CDC.sims[q.sim]) { avisos.push('Tema ' + n + ': falta la simulación «' + esc(q.sim) + '» (' + comp + ').'); return; }
        if (q.tipo === 'simulacion' && q.html && !document.querySelector(q.html)) { avisos.push('Tema ' + n + ': falta la plantilla «' + esc(q.html) + '» (' + comp + ').'); return; }
        if (enunDemo.has(normaliza(q.enunciado))) return;
        const clave = normaliza(q.enunciado) + '|' + JSON.stringify(q.opciones || q.pares || q.orden || q.sim || q.html || '');
        if (vistas.has(clave)) return;
        vistas.add(clave);
        (banco[comp] = banco[comp] || { con: [], hab: [] })[clase].push({ q, comp, area: +comp[0], base: b, sims, tema: n });
        info.preguntas++;
        info.comps.add(comp);
      };
      doc.querySelectorAll('.comprueba[data-comp]').forEach((c) => {
        let lista;
        try { lista = CDC.leeJSON(c); } catch (e) { avisos.push('Tema ' + n + ': el Comprueba ' + esc(c.dataset.comp) + ' tiene un error y no se usa.'); return; }
        const b = base + (c.dataset.base || '');
        // 2 de conocimientos y la tercera de habilidades
        (lista || []).forEach((q, i) => anade(c.dataset.comp, q, i < 2 ? 'con' : i === 2 ? 'hab' : (q.tipo === 'test' ? 'con' : 'hab'), b));
      });
      doc.querySelectorAll('.repaso-test').forEach((c) => {
        let lista;
        try { lista = CDC.leeJSON(c); } catch (e) { avisos.push('Tema ' + n + ': el test de repaso tiene un error y no se usa.'); return; }
        const b = base + (c.dataset.base || '');
        (lista || []).forEach((q) => anade(q.comp, q, q.tipo === 'test' ? 'con' : 'hab', b));
      });
      temas.push(info);
      informa(info);
    }
    BANCO = { banco, temas, avisos };
    return BANCO;
  }

  // Scripts propios del tema (<script> sin src): amplían sus simulaciones HTML (campos de texto, botones que se
  // activan…) con escuchadores en document. Se ejecutan después de importar sus plantillas, como en su página.
  function ejecutaScripts(doc, n) {
    doc.querySelectorAll('script:not([src])').forEach((s) => {
      const tipo = (s.getAttribute('type') || '').trim().toLowerCase();
      if (tipo && tipo !== 'text/javascript') return;
      const e = document.createElement('script');
      e.dataset.tema = n;
      e.textContent = 'try {\n' + s.textContent + '\n} catch (e) { console.warn("Tema ' + n + ': un script de su página no funciona en el simulacro.", e); }';
      document.body.appendChild(e);
    });
  }

  // 2 de conocimientos y 1 de habilidades por competencia; si faltan de un tipo, se completa con el otro.
  // Las áreas van en orden (como en el panel del examen) y dentro de cada área las preguntas se barajan.
  function eligeLargo(banco) {
    const porArea = {};
    Object.keys(COMPS).forEach((comp) => {
      const b = banco[comp];
      if (!b) return;
      const con = CDC.baraja(b.con), hab = CDC.baraja(b.hab);
      const elegidas = con.slice(0, 2).concat(hab.slice(0, 1));
      const resto = con.slice(2).concat(hab.slice(1));
      while (elegidas.length < 3 && resto.length) elegidas.push(resto.shift());
      elegidas.forEach((x) => (porArea[x.area] = porArea[x.area] || []).push(x));
    });
    return [1, 2, 3, 4, 5].flatMap((a) => CDC.baraja(porArea[a] || []));
  }

  async function preparaLargo() {
    muestra('v-carga');
    $('#sm-barra').textContent = 'Simulacro del examen · ' + PARTES.largo;
    const ul = $('#sm-temas'), resumen = $('#sm-carga-resumen'), bEmp = $('#sm-carga-empieza');
    ul.innerHTML = ''; resumen.innerHTML = ''; bEmp.disabled = true;
    const informa = (t) => {
      const li = el('li', t.ok && t.preguntas ? 'ok' : 'falta');
      li.innerHTML = '<b>Tema ' + t.n + '</b>: ' + (!t.ok ? 'todavía no está publicado. Sus preguntas no salen en este simulacro.'
        : !t.preguntas ? 'todavía no tiene preguntas para el simulacro.'
          : t.comps.size + (t.comps.size === 1 ? ' competencia' : ' competencias') + ' y ' + t.preguntas + ' preguntas disponibles.');
      ul.appendChild(li);
    };
    let B;
    try { B = await cargaBanco(informa); } catch (e) { resumen.innerHTML = '<p class="sm-caja aviso">No se han podido cargar los temas. Abre el curso desde la web, no desde el archivo.</p>'; return; }
    const lista = eligeLargo(B.banco);
    const sinPreg = Object.keys(COMPS).filter((c) => !B.banco[c]);
    const cortas = Object.keys(COMPS).filter((c) => B.banco[c] && B.banco[c].con.length + B.banco[c].hab.length < 3);
    let h = '<p class="sm-resumen">Este intento tiene <b>' + lista.length + ' de ' + TOTAL_LARGO + '</b> preguntas.</p>';
    if (sinPreg.length) h += '<p class="sm-caja aviso">Faltan preguntas de ' + sinPreg.length + (sinPreg.length === 1 ? ' competencia' : ' competencias') + ': ' + sinPreg.join(', ') + '. El resultado solo vale para las áreas que tienen preguntas.</p>';
    if (cortas.length) h += '<p class="sm-caja aviso">Estas competencias tienen menos de 3 preguntas: ' + cortas.join(', ') + '.</p>';
    if (B.avisos.length) h += '<details class="sm-detalles"><summary>Avisos para el profesor (' + B.avisos.length + ')</summary><ul>' + B.avisos.map((a) => '<li>' + a + '</li>').join('') + '</ul></details>';
    resumen.innerHTML = h;
    bEmp.disabled = !lista.length;
    bEmp.onclick = () => empieza('largo', lista.map((x) => ({ q: x.q, area: x.area, comp: x.comp, base: x.base, sims: x.sims, tema: x.tema })), { incompleto: sinPreg.length > 0 });
  }

  /* ======================================================================
     EXAMEN
     ====================================================================== */
  function empieza(parte, lista, extra) {
    const items = lista.map((x, k) => Object.assign({ k, n: k + 1, montada: false, respondida: false, marcada: false, guardado: null, simOk: null }, x));
    examen = Object.assign({ parte, items, actual: -1, inicio: Date.now(), fin: Date.now() + DURACION, terminado: false }, extra || {});
    $('#sm-preguntas').innerHTML = '';
    $('#sm-barra').textContent = 'Simulacro del examen · ' + PARTES[parte];
    montaPanel();
    muestra('v-examen');
    ve(0);
    tic();
    examen.reloj = setInterval(tic, 1000);
    window.addEventListener('beforeunload', avisaSalida);
  }
  function avisaSalida(e) { if (examen && !examen.terminado) { e.preventDefault(); e.returnValue = ''; } }
  function paraExamen() {
    if (!examen) return;
    examen.terminado = true;
    clearInterval(examen.reloj);
    window.removeEventListener('beforeunload', avisaSalida);
  }

  /* ---------- reloj ---------- */
  function tic() {
    if (!examen || examen.terminado) return;
    const s = Math.max(0, Math.round((examen.fin - Date.now()) / 1000));
    $('#sm-reloj').textContent = dos(Math.floor(s / 3600)) + ':' + dos(Math.floor(s / 60) % 60) + ':' + dos(s % 60);
    $('#sm-tiempo').classList.toggle('poco', s <= 300);
    if (s === 0) finaliza(true);
  }

  /* ---------- panel de preguntas por áreas ---------- */
  function montaPanel() {
    const cont = $('#sm-areas');
    cont.innerHTML = '';
    [1, 2, 3, 4, 5].forEach((a) => {
      const its = examen.items.filter((it) => it.area === a);
      if (!its.length) return;
      const g = el('div', 'sm-area', '<h3>' + AREAS[a] + '</h3>');
      g.style.setProperty('--c', 'var(--a' + a + ')');
      const nums = el('div', 'sm-nums');
      its.forEach((it) => {
        const ico = esSim(it.q) ? ICO.sim : it.q.tipo === 'reto' ? ICO.reto : '';
        const b = el('button', 'sm-num', '<span>' + it.n + '</span>' + ico + '<span class="sm-est">' + ICO['estrella-llena'] + '</span>');
        b.type = 'button';
        b.addEventListener('click', () => ve(it.k));
        it.boton = b;
        nums.appendChild(b);
      });
      g.appendChild(nums);
      cont.appendChild(g);
    });
  }
  function pintaPanel() {
    const its = examen.items;
    its.forEach((it) => {
      const b = it.boton;
      b.classList.toggle('respondida', it.respondida);
      b.classList.toggle('actual', it.k === examen.actual);
      b.classList.toggle('marcada', it.marcada);
      const tipo = esSim(it.q) ? ', simulación' : it.q.tipo === 'reto' ? ', reto' : '';
      b.setAttribute('aria-label', 'Pregunta ' + it.n + tipo + (it.respondida ? ', respondida' : ', sin responder') + (it.marcada ? ', marcada' : ''));
      if (it.k === examen.actual) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    const r = its.filter((it) => it.respondida).length;
    $('#sm-resp').textContent = r + '/' + its.length;
    $('#sm-anillo').setAttribute('stroke-dashoffset', (87.96 * (1 - r / its.length)).toFixed(2));
  }

  /* ---------- montar una pregunta ---------- */
  const anchoDisponible = () => Math.max(280, $('#sm-preguntas').clientWidth || 860);

  function montaItem(it) {
    if (it.montada) return;
    it.montada = true;
    const q = it.q, base = it.base || '';
    const ruta = (p) => (!p || /^(https?:|data:|\/)/.test(p) ? p : base + p);
    // Copia con las rutas resueltas y sin ayudas que el examen no tiene (pista, etiqueta)
    const qq = Object.assign({}, q, { base, imagen: ruta(q.imagen), archivo: ruta(q.archivo), imagenes: q.imagenes && q.imagenes.map(ruta) });
    delete qq.pista; delete qq.etiqueta;

    const wrap = el('div', 'sm-item');
    wrap.dataset.n = it.n;
    const enun = el('div', 'sm-enun', '<p>' + fmt(q.enunciado) + '</p>');
    if (qq.imagen) { const i = el('img', 'sm-img-enun'); i.src = qq.imagen; i.alt = ''; enun.appendChild(i); }
    wrap.appendChild(enun);
    wrap.appendChild(el('div', 'sm-instr', '<span class="sm-instr-ico" aria-hidden="true">?</span><div><p>' + fmt(instrucciones(q)) + '</p>' +
      (esMover(q) ? '<p class="sm-instr-ayuda">' + AYUDA_MOVER + '</p>' : '') + '</div>'));
    const resp = el('div', 'preg sm-resp' + (q.soloImagen ? ' sm-solo-img' : '') + (esSim(q) ? ' sm-resp-sim' : ''));
    wrap.appendChild(resp);
    $('#sm-preguntas').appendChild(wrap);
    it.wrap = wrap; it.resp = resp; it.enun = enun;

    if (esSim(q)) {
      // Cada pregunta usa los datos de la simulación de su tema (o de la demo)
      if (q.sim && it.sims && it.sims[q.sim]) CDC.sims[q.sim] = it.sims[q.sim];
      if (q.sim) qq.ancho = Math.min(800, anchoDisponible());
      it.ui = CDC.TIPOS.simulacion(resp, qq, { modoExamen: true, alTerminar: (ok) => simTerminada(it, ok) });
      if (q.html) ajustaHtml(resp);
      return;
    }

    it.ui = CDC.TIPOS[q.tipo](resp, qq);
    if (q.tipo === 'reto') colocaReto(it);
    const ops = $('.opciones.rejilla', resp);
    if (ops) { const n = q.opciones.length; ops.style.setProperty('--n', n === 4 ? 4 : Math.min(n, 3)); }
    if (esMover(q)) {
      // Título de la columna que se ordena, como en el examen
      const parejas = $('.parejas', resp), orden = $('.orden', resp);
      if (parejas) parejas.prepend(el('p', 'sm-ordena-tit sm-hueco'), el('p', 'sm-ordena-tit', 'Ordena esta lista'));
      if (orden) orden.prepend(el('p', 'sm-ordena-tit', 'Ordena esta lista'));
      igualaFilas(resp);
    }
    const fila = el('div', 'sm-guardar-fila');
    const b = el('button', 'sm-btn sm-guardar', ICO.ok + 'Guardar');
    b.type = 'button';
    const msg = el('p', 'sm-msg');
    msg.setAttribute('role', 'status');
    b.addEventListener('click', () => guarda(it));
    fila.append(b, msg);
    wrap.appendChild(fila);
    it.msg = msg;
    it.inicial = estado(it);
    // Si cambias una respuesta ya guardada, se avisa de que hay que volver a guardar
    const vigila = () => setTimeout(() => {
      if (examen.terminado || !it.respondida) return;
      if (!igual(estado(it), it.guardado)) { msg.textContent = 'Has cambiado la respuesta. Pulsa Guardar para guardarla.'; msg.className = 'sm-msg aviso'; }
      else { msg.textContent = 'Respuesta guardada.'; msg.className = 'sm-msg ok'; }
    }, 0);
    resp.addEventListener('click', vigila);
    resp.addEventListener('input', vigila);
    resp.addEventListener('pointerup', vigila);
  }

  // En los retos, el botón Descargar va dentro del enunciado y la respuesta escrita en su cuadro, como en el examen
  function colocaReto(it) {
    const ra = $('.reto-archivo', it.resp);
    if (ra) {
      const a = $('a', ra), nombre = $('.nombre', ra).textContent;
      a.className = 'sm-btn sm-descargar';
      a.innerHTML = ICO.descarga + 'Descargar';
      const f = el('div', 'sm-descarga');
      f.append(a, el('span', 'sm-archivo', esc(nombre)));
      it.enun.appendChild(f);
      ra.remove();
    }
    const inp = $('input.resp-texto', it.resp);
    if (inp) {
      const fila = el('label', 'sm-respuesta-fila', '<span>Respuesta:</span>');
      inp.replaceWith(fila);
      fila.appendChild(inp);
      inp.placeholder = '';
    }
  }

  // Emparejar: todas las filas con la misma altura, para que cada elemento quede junto a su pareja aunque se mueva
  function igualaFilas(resp) {
    const cajas = $$('.parejas .fija, .parejas .mov', resp);
    if (!cajas.length) return;
    cajas.forEach((c) => { c.style.minHeight = ''; });
    const h = Math.max(...cajas.map((c) => c.offsetHeight));
    if (h > 0) cajas.forEach((c) => { c.style.minHeight = h + 'px'; });
  }

  // Simulación HTML más ancha que la columna (por ejemplo, una ventana de navegador): se reduce
  function ajustaHtml(resp) {
    requestAnimationFrame(() => {
      const hijo = $('.sim-marco', resp) && $('.sim-marco', resp).firstElementChild;
      if (!hijo) return;
      const disp = resp.clientWidth, w = hijo.getBoundingClientRect().width;
      const z = parseFloat(getComputedStyle(hijo).zoom) || 1;
      if (w > disp && disp > 0) hijo.style.zoom = (z * disp / w).toFixed(3);
    });
  }

  /* ---------- estado de la respuesta (para Guardar y para restaurar lo guardado) ---------- */
  function estado(it) {
    const q = it.q, c = it.resp;
    if (conOpciones(q)) return $$('.opcion', c).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => +b.dataset.i).sort((a, b) => a - b);
    if (esMover(q)) return $$('.mov', c).map((d) => +d.dataset.i);
    if (esTexto(q)) return $('input.resp-texto', c).value;
    return null;
  }
  function ponEstado(it, s) {
    const q = it.q, c = it.resp;
    if (conOpciones(q)) $$('.opcion', c).forEach((b) => b.setAttribute('aria-pressed', s.includes(+b.dataset.i) ? 'true' : 'false'));
    else if (esMover(q)) {
      const sel = $('.mov.sel', c);
      if (sel) sel.click(); // deshace una selección a medias
      const por = {};
      $$('.mov', c).forEach((d) => { por[d.dataset.i] = d; });
      const lista = $('.mov', c).parentElement;
      s.forEach((i) => lista.appendChild(por[i]));
    } else if (esTexto(q)) $('input.resp-texto', c).value = s;
  }
  const vacio = (it, s) => (conOpciones(it.q) ? !s.length : esTexto(it.q) ? !String(s).trim() : false);

  function guarda(it) {
    const s = estado(it);
    if (vacio(it, s)) {
      it.msg.textContent = esTexto(it.q) ? 'Escribe tu respuesta antes de pulsar Guardar.' : 'Elige una respuesta antes de pulsar Guardar.';
      it.msg.className = 'sm-msg aviso';
      return;
    }
    it.guardado = s;
    it.respondida = true;
    it.msg.textContent = 'Respuesta guardada.';
    it.msg.className = 'sm-msg ok';
    pintaPanel();
  }

  // Al salir de una pregunta sin pulsar Guardar, se vuelve a lo guardado (como en el examen)
  function salDe(it, callado) {
    if (!it || !it.montada || esSim(it.q)) return;
    const sel = $('.mov.sel', it.resp);
    if (sel) sel.click();
    const ref = it.respondida ? it.guardado : it.inicial;
    if (!igual(estado(it), ref)) {
      ponEstado(it, ref);
      if (!callado) toast('Pregunta ' + it.n + ': no has pulsado Guardar. ' + (it.respondida ? 'Se mantiene la respuesta que guardaste.' : 'La respuesta no se ha guardado.'));
    }
    if (it.msg) { it.msg.textContent = ''; it.msg.className = 'sm-msg'; }
  }

  function simTerminada(it, ok) {
    it.respondida = true;
    it.simOk = ok;
    // El motor solo enseña la solución fuera del modo examen, salvo cuando lo escrito no coincide: se cambia el aviso
    setTimeout(() => {
      const v = $('.sim-aviso', it.resp);
      if (!v) return;
      if (/dos clics/.test(v.textContent)) it.simMotivo = 'clics';
      if (/No es correcto/.test(v.textContent)) {
        it.simMotivo = 'texto';
        v.innerHTML = '<b>Pregunta respondida</b>Tu respuesta se ha guardado.';
      }
    }, 0);
    if (examen && !examen.terminado) pintaPanel();
  }

  /* ---------- navegación ---------- */
  function ve(k) {
    if (!examen || examen.terminado) return;
    const prev = examen.items[examen.actual];
    if (prev && prev.k !== k) salDe(prev);
    examen.actual = k;
    const it = examen.items[k];
    $$('#sm-preguntas > .sm-item').forEach((w) => { w.hidden = true; });
    montaItem(it);
    it.wrap.hidden = false;
    $('#sm-num').textContent = 'Pregunta ' + it.n;
    pintaMarcar();
    pintaPanel();
    $('#sm-ant').style.visibility = k === 0 ? 'hidden' : '';
    $('#sm-sig').style.visibility = k === examen.items.length - 1 ? 'hidden' : '';
    const arriba = $('#v-examen').getBoundingClientRect().top;
    if (arriba < 0) window.scrollBy(0, arriba - 12);
  }
  function pintaMarcar() {
    const it = examen.items[examen.actual];
    const b = $('#sm-marcar');
    b.setAttribute('aria-pressed', it.marcada ? 'true' : 'false');
    b.querySelector('.sm-ico-txt').innerHTML = it.marcada ? ICO['estrella-llena'] : ICO.estrella;
  }
  // La siguiente de la lista a partir de la actual (y si no hay, la primera)
  const siguienteDe = (lista) => lista.find((it) => it.k > examen.actual) || lista[0];

  /* ---------- finalizar ---------- */
  function pideFinalizar() {
    const pend = examen.items.filter((it) => !it.respondida), marc = examen.items.filter((it) => it.marcada);
    const botones = [['Ver última pregunta', null, 'sec']];
    let html;
    if (pend.length || marc.length) {
      html = '';
      if (pend.length) html += '<p>Tienes <b>' + pend.length + (pend.length === 1 ? ' pregunta' : ' preguntas') + ' sin responder</b>. Las preguntas sin responder cuentan como falladas.</p>';
      if (marc.length) html += '<p>Tienes <b>' + marc.length + (marc.length === 1 ? ' pregunta marcada' : ' preguntas marcadas') + '</b> para revisar.</p>';
      if (pend.length) botones.push(['Ir a pregunta sin responder', () => ve(siguienteDe(pend).k), 'sec']);
      if (marc.length) botones.push(['Ir a pregunta marcada', () => ve(siguienteDe(marc).k), 'sec']);
    } else {
      html = '<p>Has respondido todas las preguntas. Cuando vayas a los resultados, ya no puedes cambiar tus respuestas.</p>';
    }
    botones.push(['Ir a resultados', () => finaliza(false)]);
    modal('¿Quieres terminar el examen?', html, botones);
  }

  function finaliza(porTiempo) {
    if (!examen || examen.terminado) return;
    cierraModal();
    salDe(examen.items[examen.actual], true);
    paraExamen();
    examen.items.forEach(corrige);
    const r = calcula(porTiempo);
    guardaResultado(r);
    pintaResultados(r, porTiempo);
  }

  // Corrige una pregunta y la deja lista para la revisión
  function corrige(it) {
    const q = it.q;
    if (esSim(q)) {
      it.ok = it.simOk === true;
      it.final = !it.respondida ? 'nr' : it.ok ? 'ok' : 'ko';
      return;
    }
    montaItem(it);
    if (it.respondida) {
      ponEstado(it, it.guardado);
      it.ok = it.ui.comprobar() === true;
      it.final = it.ok ? 'ok' : 'ko';
      // Opciones correctas que no has marcado: se distinguen de las que sí marcaste
      $$('.opcion.correcta[aria-pressed="false"]', it.resp).forEach((b) => {
        b.classList.add('sm-falta');
        b.appendChild(el('span', 'sm-etq-falta', 'No la has marcado'));
      });
    } else {
      ponEstado(it, it.inicial);
      it.ok = false;
      it.final = 'nr';
      if (conOpciones(q)) {
        const ok = [].concat(q.correcta);
        $$('.opcion', it.resp).forEach((b) => { if (ok.includes(+b.dataset.i)) b.classList.add('correcta'); });
      }
    }
    it.resp.setAttribute('data-corregida', '');
    $$('.lista-mov', it.resp).forEach((l) => l.setAttribute('data-bloqueada', ''));
    $$('input', it.resp).forEach((i) => { i.disabled = true; });
  }

  function calcula(porTiempo) {
    const areas = {}, comps = {};
    examen.items.forEach((it) => {
      const a = areas[it.area] = areas[it.area] || { a: 0, t: 0 };
      a.t++; if (it.ok) a.a++;
      if (it.comp) { const c = comps[it.comp] = comps[it.comp] || { a: 0, t: 0 }; c.t++; if (it.ok) c.a++; }
    });
    const aciertos = examen.items.filter((it) => it.ok).length, total = examen.items.length;
    const incompleto = !!examen.incompleto || [1, 2, 3, 4, 5].some((a) => !areas[a]);
    const apto = Object.values(areas).every((x) => x.a / x.t >= UMBRAL);
    const r = {
      parte: examen.parte, fecha: new Date().toISOString(), aciertos, total, pct: pct(aciertos, total), apto, incompleto,
      areas, segundos: Math.round((Math.min(Date.now(), examen.fin) - examen.inicio) / 1000), porTiempo: !!porTiempo,
    };
    if (examen.parte === 'largo') r.compsFalladas = Object.keys(COMPS).filter((c) => comps[c] && comps[c].a < comps[c].t).map((c) => ({ comp: c, a: comps[c].a, t: comps[c].t }));
    return r;
  }

  /* ======================================================================
     RESULTADOS Y REVISIÓN
     ====================================================================== */
  function pintaResultados(r, porTiempo) {
    const v = $('#v-resultados');
    v.innerHTML = '';
    const filas = [1, 2, 3, 4, 5].filter((a) => r.areas[a]).map((a) => {
      const x = r.areas[a], p = pct(x.a, x.t), bajo = x.a / x.t < UMBRAL;
      return '<tr><td><span class="sm-area-nom" style="--c:var(--a' + a + ')"><img src="../assets/img/area-' + ICONO_AREA[a] + '.webp" alt="">' + AREAS[a] + '</span></td>' +
        '<td class="num">' + x.a + ' de ' + x.t + '</td><td class="num' + (bajo ? ' sm-bajo' : '') + '">' + p + ' %</td></tr>';
    }).join('');
    const min = Math.floor(r.segundos / 60), seg = r.segundos % 60;
    let nota, mensaje;
    if (r.incompleto) {
      nota = '<span class="sm-incompleto">No se puede calcular</span>';
      mensaje = 'Este intento no tiene preguntas de todas las competencias. Mira el porcentaje de cada área.';
    } else if (r.apto) {
      nota = '<span class="sm-apto">' + ICO.ok + 'Apto</span>';
      mensaje = '¡Enhorabuena! Has superado el simulacro.';
    } else {
      nota = '<span class="sm-noapto">No apto</span>';
      mensaje = 'Todavía no lo has superado. Repasa las áreas que tienen menos del 75 %.';
    }
    const tarjeta = el('div', 'sm-res');
    tarjeta.innerHTML =
      '<div class="sm-res-cab">' + ICO.barras + '<h1>Resultados</h1><p>' + PARTES[r.parte] + '</p></div>' +
      (porTiempo ? '<p class="sm-caja aviso">Se ha acabado el tiempo. Se han corregido las respuestas que habías guardado.</p>' : '') +
      '<table class="sm-tabla-res"><thead><tr><th>Área</th><th class="num">Aciertos</th><th class="num">%</th></tr></thead><tbody>' + filas + '</tbody>' +
      '<tfoot><tr><th>Total preguntas</th><td class="num">' + r.aciertos + ' de ' + r.total + '</td><td class="num">' + r.pct + ' %</td></tr></tfoot></table>' +
      '<p class="sm-nota">Nota global: ' + nota + '</p>' +
      '<p class="sm-regla">Tienes Apto si aciertas al menos el 75 % de las preguntas de cada área.</p>' +
      '<p class="sm-mensaje">' + mensaje + '</p>' +
      '<p class="sm-regla peq">Tiempo: ' + min + ' min ' + seg + ' s. La ficha oficial del nivel básico pide el 50 % de cada área y el 75 % del total. Este simulacro usa la regla de la demo, que es más exigente.</p>';
    if (r.parte === 'largo' && r.compsFalladas && r.compsFalladas.length) {
      const temasOk = new Set((BANCO ? BANCO.temas : []).filter((t) => t.ok).map((t) => t.n));
      tarjeta.appendChild(el('div', 'sm-repasa',
        '<h2>Competencias que tienes que repasar</h2><ul>' + r.compsFalladas.map((c) => {
          const n = c.comp[0], txt = '<b>' + c.comp + '</b> ' + COMPS[c.comp];
          return '<li>' + (temasOk.has(+n) ? '<a href="../tema' + n + '/#c' + c.comp.replace('.', '') + '">' + txt + '</a>' : txt) + ' <span class="sm-rep-n">' + c.a + ' de ' + c.t + '</span></li>';
        }).join('') + '</ul>'));
    }
    const bots = el('div', 'sm-botones sm-centro');
    const bRev = el('button', 'sm-btn sec', 'Ver la revisión'); bRev.type = 'button';
    bRev.addEventListener('click', () => $('#sm-revision').scrollIntoView({ behavior: 'smooth' }));
    const bRep = el('button', 'sm-btn sec', 'Repetir'); bRep.type = 'button';
    bRep.addEventListener('click', () => (r.parte === 'demo' ? empiezaDemo() : preparaLargo()));
    const bFin = el('button', 'sm-btn', 'Finalizar'); bFin.type = 'button';
    bFin.addEventListener('click', () => muestra('v-portada'));
    bots.append(bRev, bRep, bFin);
    tarjeta.appendChild(bots);
    tarjeta.appendChild(el('p', 'sm-regla peq sm-centro', 'El resultado se guarda en este navegador.'));
    v.appendChild(tarjeta);

    const rev = el('div', 'sm-revision');
    rev.id = 'sm-revision';
    rev.innerHTML = '<h2>Revisión pregunta a pregunta</h2><p class="sm-rev-leyenda">En verde, la respuesta correcta. En rojo, tu respuesta cuando no es correcta. Con el borde de rayas, una respuesta correcta que no has marcado. Debajo de cada pregunta tienes la explicación.</p>' +
      '<label class="sm-filtro"><input type="checkbox" id="sm-solo-falladas"> Ver solo las preguntas que no has acertado</label>';
    const lista = el('div', 'sm-rev-lista');
    examen.items.forEach((it) => lista.appendChild(bloqueRevision(it)));
    rev.appendChild(lista);
    v.appendChild(rev);
    $('#sm-solo-falladas').addEventListener('change', (e) => lista.classList.toggle('sm-solo-falladas', e.target.checked));
    muestra('v-resultados');
  }

  function textoCorrecto(q) {
    if (conOpciones(q)) return [].concat(q.correcta).map((i) => fmt(q.opciones[i])).join(' · ');
    if (q.tipo === 'emparejar') return '<ul>' + q.pares.map((p) => '<li>' + fmt(p[0]) + ' → ' + fmt(p[1]) + '</li>').join('') + '</ul>';
    if (q.tipo === 'ordenar') return '<ol>' + q.orden.map((t) => '<li>' + fmt(t) + '</li>').join('') + '</ol>';
    if (esTexto(q)) return fmt([].concat(q.respuesta)[0]);
    return '';
  }

  function bloqueRevision(it) {
    const q = it.q;
    const estados = { ok: 'Correcta', ko: 'Incorrecta', nr: 'Sin responder' };
    const art = el('article', 'sm-rev sm-rev-' + it.final);
    art.innerHTML = '<div class="sm-rev-cab"><span class="sm-rev-n">Pregunta ' + it.n + '</span>' +
      '<span class="sm-rev-area" style="--c:var(--a' + it.area + ')">Área ' + it.area + (examen.parte === 'largo' && it.comp ? ' · competencia ' + it.comp : '') + '</span>' +
      '<span class="sm-rev-estado">' + estados[it.final] + '</span></div>';
    if (it.wrap) {
      it.wrap.hidden = false;
      it.resp.classList.remove('sm-solo-img');
      art.appendChild(it.wrap);
    } else {
      art.appendChild(el('div', 'sm-item', '<div class="sm-enun"><p>' + fmt(q.enunciado) + '</p></div>'));
    }
    if (esSim(q)) {
      const txt = it.final === 'ok' ? 'Has hecho la tarea bien.'
        : it.final === 'nr' ? 'No has terminado la tarea.'
          : it.simMotivo === 'texto' ? 'Lo que has escrito no coincide con lo que pide el enunciado.' : 'Has fallado dos clics.';
      art.appendChild(el('p', 'sm-sim-res', txt));
    } else if (it.final === 'nr' || (it.final === 'ko' && esTexto(q))) {
      art.appendChild(el('div', 'sm-sol', '<b>Respuesta correcta:</b> ' + textoCorrecto(q)));
    }
    if (q.pasos && q.pasos.length) art.appendChild(el('div', 'sm-pasos-rev', '<b>Cómo se resuelve</b><ol>' + q.pasos.map((p) => '<li>' + fmt(p) + '</li>').join('') + '</ol>'));
    else if (q.pista && q.pista.length) art.appendChild(el('div', 'sm-pasos-rev', '<b>Cómo se resuelve</b><ol>' + q.pista.map((p) => '<li>' + fmt(p) + '</li>').join('') + '</ol>'));
    if (q.explicacion) art.appendChild(el('div', 'sm-exp', '<b>Explicación.</b> ' + fmt(q.explicacion)));
    return art;
  }

  /* ======================================================================
     INICIO
     ====================================================================== */
  function empiezaDemo() {
    empieza('demo', DEMO.map((q) => ({ q, area: q.area, comp: q.comp, base: 'demo/', sims: DEMO_SIMS })));
  }

  function init() {
    $$('.sm-ico-txt[data-ico]').forEach((s) => { s.innerHTML = ICO[s.dataset.ico] || ''; });
    $('#sm-empieza-demo').addEventListener('click', empiezaDemo);
    $('#sm-empieza-largo').addEventListener('click', preparaLargo);
    $('#sm-carga-volver').addEventListener('click', () => muestra('v-portada'));
    $('#sm-ant').addEventListener('click', () => ve(examen.actual - 1));
    $('#sm-sig').addEventListener('click', () => ve(examen.actual + 1));
    $('#sm-marcar').addEventListener('click', () => {
      const it = examen.items[examen.actual];
      it.marcada = !it.marcada;
      pintaMarcar();
      pintaPanel();
    });
    $('#sm-finalizar').addEventListener('click', pideFinalizar);
    $('#sm-salir').addEventListener('click', () => modal('¿Quieres salir del examen?', '<p>Si sales ahora, pierdes las respuestas de este intento.</p>',
      [['Seguir con el examen', null, 'sec'], ['Salir', () => { paraExamen(); muestra('v-portada'); }]]));
    // Para las pruebas automáticas
    window.SIMULACRO = { estado: () => examen, ve, finaliza, cargaBanco, eligeLargo };
    muestra('v-portada');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
