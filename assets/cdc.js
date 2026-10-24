/* Motor común de las presentaciones de Competencias digitales para la ciudadanía (nivel básico).
 *
 *  1. Numera las diapositivas, pone la pastilla de sección (data-seccion) y el botón «Inicio».
 *  2. Buscador de la unidad (tecla B), como en Sistemas Operativos Monopuesto.
 *  3. Piensa: respuesta oculta tras un botón.
 *       <div class="piensa"> … <button class="btn revela-btn">Ver la respuesta</button> <div class="resp">…</div> </div>
 *  4. Fotos con crédito y visor a pantalla completa: <figure class="foto"><img …><figcaption class="credito">…</figcaption></figure>
 *  5. Preguntas como las del examen. Cada una es un objeto JSON:
 *       { "tipo": "test", "enunciado": "…", "opciones": ["…"], "correcta": 1, "explicacion": "…" }
 *         correcta puede ser una lista (varias respuestas); "imagenes": ["img/a.png", …] pone imágenes en las opciones;
 *         "imagen": "img/x.png" pone una imagen en el enunciado; "barajar": false mantiene el orden.
 *       { "tipo": "emparejar", "enunciado": "…", "pares": [["SMS", "Se envía desde el móvil"], …] }
 *       { "tipo": "ordenar", "enunciado": "…", "orden": ["primer paso", "segundo paso", …] }
 *         en emparejar y ordenar, "ordenInicial": [2, 0, 1] fija cómo sale la lista que se mueve (si no, se baraja)
 *       { "tipo": "reto", "enunciado": "…", "archivo": "retos/x.xlsx", "opciones": [...], "correcta": 0 }
 *         o "respuesta": ["CARPETA 9", "carpeta9"] para escribir la respuesta; "pista": ["paso 1", …]
 *       { "tipo": "simulacion", "enunciado": "…", "sim": "q13-usb" }          (pantallas de imagen, CDC.sim)
 *       { "tipo": "simulacion", "enunciado": "…", "html": "#plantilla-id" }  (pantallas HTML de móvil)
 *     Se colocan así:
 *       <div class="preg-bloque"><script type="application/json">{…}</script></div>       una pregunta (práctica)
 *       <div class="comprueba" data-comp="4.1"><script type="application/json">[{…},{…},{…}]</script></div>
 *       <div class="repaso-test"><script type="application/json">[{…}, …]</script></div>   con «Otra pregunta»
 *  6. Simulaciones de imagen: los datos se registran con CDC.sim('id', {inicio, ancho, alto, pantallas}) en un .js aparte
 *     (el mismo formato que las simulaciones extraídas de la demo de tuCertiCyL). Un fallo permitido; el segundo anula.
 *  7. Progreso: el resultado de cada «Comprueba» se guarda en el navegador (localStorage, clave cdc-progreso).
 *     <span class="estado-comp" data-comp="4.1"></span> muestra el estado de una competencia.
 */
(function () {
  'use strict';
  const CDC = window.CDC = window.CDC || {};
  CDC.sims = CDC.sims || {};
  CDC.sim = (id, datos) => { CDC.sims[id] = datos; };

  /* ---------- utilidades ---------- */
  const escapaHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Texto con **negrita** y `código`
  const fmt = (s) => escapaHtml(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const baraja = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const leeJSON = (cont) => { const s = cont.querySelector(':scope > script[type="application/json"]'); return s ? JSON.parse(s.textContent) : null; };
  const normaliza = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---------- progreso guardado en el navegador ---------- */
  const CLAVE = 'cdc-progreso';
  const progreso = {
    todo() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; } },
    get(comp) { return this.todo()[comp] || null; },
    set(comp, datos) {
      try {
        const t = this.todo();
        // Una competencia superada no deja de estarlo por un intento peor
        if (t[comp] && t[comp].ok && !datos.ok) return;
        t[comp] = Object.assign({ fecha: new Date().toISOString().slice(0, 10) }, datos);
        localStorage.setItem(CLAVE, JSON.stringify(t));
      } catch (e) { /* sin almacenamiento: el curso funciona igual */ }
      pintaEstados();
    },
  };
  CDC.progreso = progreso;
  function pintaEstados() {
    document.querySelectorAll('.estado-comp[data-comp]').forEach((e) => {
      const p = progreso.get(e.dataset.comp);
      e.dataset.estado = p ? (p.ok ? 'ok' : 'ko') : 'pendiente';
      e.textContent = p ? (p.ok ? 'Comprueba superado' : 'Comprueba: ' + p.aciertos + ' de 3 · repítelo') : 'Comprueba sin hacer';
    });
    document.querySelectorAll('.estado-area[data-comps]').forEach((e) => {
      const comps = e.dataset.comps.split(',');
      const ok = comps.filter((c) => (progreso.get(c) || {}).ok).length;
      e.textContent = comps.length === 1 ? (ok ? 'Comprueba superado' : progreso.get(comps[0]) ? 'Comprueba sin superar' : 'Comprueba sin hacer') : ok + ' de ' + comps.length + ' competencias superadas';
      e.dataset.estado = ok === comps.length ? 'ok' : ok ? 'ko' : 'pendiente';
    });
  }
  window.addEventListener('storage', (e) => { if (e.key === CLAVE) pintaEstados(); });

  /* ======================================================================
     PREGUNTAS
     Cada tipo monta su interfaz en «cont» y devuelve { comprobar() → true|false|null, listo() }.
     null = la respuesta está incompleta (no se corrige).
     ====================================================================== */
  const TIPOS = {};

  /* --- test: una o varias respuestas, texto o imágenes --- */
  TIPOS.test = function (cont, q) {
    const correctas = [].concat(q.correcta);
    const multi = Array.isArray(q.correcta) && q.correcta.length > 1 || q.multiple;
    if (multi) cont.classList.add('multi');
    let orden = q.opciones.map((_, i) => i);
    if (q.barajar !== false && !q.imagenes && !/^\d+$/.test(q.opciones[0])) orden = baraja(orden);
    const numeros = !q.imagenes && q.opciones.every((o) => /^\d+$/.test(o));
    const ops = el('div', 'opciones' + (q.imagenes ? ' rejilla' : '') + (numeros ? ' numeros' : ''));
    if (q.imagenes || numeros) ops.style.setProperty('--n', Math.min(q.opciones.length, numeros ? 6 : 4));
    const botones = orden.map((i) => {
      const img = q.imagenes && q.imagenes[i];
      const b = el('button', 'opcion' + (q.imagenes ? ' con-img' : ''));
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="marca"></span>' + (img ? '<img src="' + escapaHtml(img) + '" alt="' + escapaHtml(q.opciones[i]) + '">' : '') + '<span>' + fmt(q.opciones[i]) + '</span>';
      b.addEventListener('click', () => {
        if (cont.hasAttribute('data-corregida')) return;
        if (!multi) botones.forEach((o) => o.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' && multi ? 'false' : 'true');
      });
      ops.appendChild(b);
      return b;
    });
    cont.appendChild(ops);
    return {
      comprobar() {
        const elegidas = botones.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => +b.dataset.i);
        if (!elegidas.length) return null;
        botones.forEach((b) => {
          const i = +b.dataset.i, ok = correctas.includes(i), sel = elegidas.includes(i);
          if (ok) b.classList.add('correcta'); else if (sel) b.classList.add('fallada');
        });
        return elegidas.length === correctas.length && elegidas.every((i) => correctas.includes(i));
      },
    };
  };

  /* --- lista que se ordena arrastrando o pulsando dos elementos (para emparejar y ordenar) --- */
  function listaMovil(textos, ordenInicial) {
    const lista = el('div', 'lista-mov');
    let orden = ordenInicial ? ordenInicial.slice() : baraja(textos.map((_, i) => i));
    // que no salga ya resuelta (salvo que el orden inicial venga fijado)
    if (!ordenInicial && orden.every((v, k) => v === k) && orden.length > 1) orden = orden.slice(1).concat(orden[0]);
    const items = orden.map((i) => { const d = el('div', 'mov', fmt(textos[i])); d.dataset.i = i; d.tabIndex = 0; d.setAttribute('role', 'button'); lista.appendChild(d); return d; });
    let sel = null, arr = null;
    const bloqueada = () => lista.hasAttribute('data-bloqueada');
    const cambia = (a, b) => {
      const ph = document.createComment('');
      a.replaceWith(ph); b.replaceWith(a); ph.replaceWith(b);
    };
    items.forEach((d) => {
      d.addEventListener('click', () => {
        if (bloqueada() || lista.__arrastrado) return;
        if (!sel) { sel = d; d.classList.add('sel'); return; }
        if (sel !== d) cambia(sel, d);
        sel.classList.remove('sel'); sel = null;
      });
      d.addEventListener('pointerdown', (e) => {
        if (bloqueada() || e.button !== 0) return;
        arr = { d, y0: e.clientY, movido: false };
        lista.__arrastrado = false;
        d.setPointerCapture(e.pointerId);
      });
      d.addEventListener('pointermove', (e) => {
        if (!arr || arr.d !== d) return;
        if (!arr.movido && Math.abs(e.clientY - arr.y0) < 8) return;
        arr.movido = true; lista.__arrastrado = true;
        d.classList.add('arrastrando');
        if (sel) { sel.classList.remove('sel'); sel = null; }
        const hermanos = [...lista.children];
        for (const h of hermanos) {
          if (h === d) continue;
          const r = h.getBoundingClientRect();
          if (e.clientY > r.top && e.clientY < r.bottom) {
            const antes = hermanos.indexOf(h) < hermanos.indexOf(d);
            lista.insertBefore(d, antes ? h : h.nextSibling);
            break;
          }
        }
      });
      const fin = () => { if (!arr || arr.d !== d) return; d.classList.remove('arrastrando'); arr = null; setTimeout(() => { lista.__arrastrado = false; }, 0); };
      d.addEventListener('pointerup', fin);
      d.addEventListener('pointercancel', fin);
    });
    return { lista, orden: () => [...lista.children].map((d) => +d.dataset.i), elems: () => [...lista.children] };
  }

  TIPOS.emparejar = function (cont, q) {
    const g = el('div', 'parejas');
    const fijas = el('div', 'lista-mov'), lm = listaMovil(q.pares.map((p) => p[1]), q.ordenInicial);
    q.pares.forEach((p) => fijas.appendChild(el('div', 'fija', fmt(p[0]))));
    g.append(fijas, lm.lista);
    cont.appendChild(g);
    return {
      comprobar() {
        const o = lm.orden();
        lm.lista.setAttribute('data-bloqueada', '');
        let todo = true;
        lm.elems().forEach((d, k) => { const ok = o[k] === k; d.classList.add(ok ? 'correcta' : 'fallada'); todo = todo && ok; });
        if (!todo) {
          const sol = el('div', 'fb info', '<span class="fb-tit">Parejas correctas</span>' + q.pares.map((p) => fmt(p[0]) + ' → ' + fmt(p[1])).join('<br>'));
          sol.style.display = 'block';
          cont.appendChild(sol);
        }
        return todo;
      },
    };
  };

  TIPOS.ordenar = function (cont, q) {
    const w = el('div', 'orden'), lm = listaMovil(q.orden, q.ordenInicial);
    w.appendChild(lm.lista);
    cont.appendChild(w);
    return {
      comprobar() {
        const o = lm.orden();
        lm.lista.setAttribute('data-bloqueada', '');
        let todo = true;
        lm.elems().forEach((d, k) => { const ok = o[k] === k; d.classList.add(ok ? 'correcta' : 'fallada'); todo = todo && ok; });
        if (!todo) {
          const sol = el('div', 'fb info', '<span class="fb-tit">Orden correcto</span>' + q.orden.map((t, k) => (k + 1) + '. ' + fmt(t)).join('<br>'));
          sol.style.display = 'block';
          cont.appendChild(sol);
        }
        return todo;
      },
    };
  };

  /* --- reto: descargar un archivo, resolverlo con el ordenador y responder --- */
  TIPOS.reto = function (cont, q) {
    const nombre = q.archivo.split('/').pop();
    const a = el('div', 'reto-archivo',
      '<span class="pill">Reto</span><span class="nombre">' + escapaHtml(nombre) + '</span>' +
      '<a class="btn peq" href="' + escapaHtml(q.archivo) + '" download>Descargar</a>');
    cont.appendChild(a);
    if (q.pista) {
      const pb = el('button', 'btn sec peq', 'Ver pista');
      pb.type = 'button';
      pb.addEventListener('click', () => { cont.toggleAttribute('data-pista'); pb.textContent = cont.hasAttribute('data-pista') ? 'Ocultar pista' : 'Ver pista'; ajustaAlto(cont); });
      const pp = el('ol', 'pasos peq pista-pasos', q.pista.map((p) => '<li>' + fmt(p) + '</li>').join(''));
      a.appendChild(pb);
      cont.appendChild(pp);
    }
    if (q.opciones) return TIPOS.test(cont, q);
    const inp = el('input', 'resp-texto');
    inp.type = 'text'; inp.placeholder = 'Escribe aquí tu respuesta'; inp.setAttribute('aria-label', 'Respuesta');
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    cont.appendChild(inp);
    return {
      comprobar() {
        if (!inp.value.trim()) return null;
        inp.disabled = true;
        const ok = [].concat(q.respuesta).some((r) => normaliza(r) === normaliza(inp.value));
        inp.style.borderColor = ok ? 'var(--ok)' : 'var(--ko)';
        return ok;
      },
    };
  };

  /* --- simulación: clic en pantallas (imágenes con zonas, o pantallas HTML) --- */
  TIPOS.simulacion = function (cont, q, ctx) {
    const lado = el('div', 'sim-estado', '<span class="vida"></span><span class="vida"></span><span>Puedes fallar 1 clic. El segundo fallo anula la pregunta.</span>');
    cont.appendChild(lado);
    const marco = el('div', 'sim-marco');
    marco.tabIndex = 0;
    marco.setAttribute('role', 'application');
    marco.setAttribute('aria-label', 'Simulación: haz clic en la pantalla');
    cont.appendChild(marco);
    let errores = 0, terminado = false, resultado = null;
    const vidas = lado.querySelectorAll('.vida');
    const aviso = (titulo, texto, boton, alPulsar) => {
      const v = el('div', 'sim-aviso', '<b>' + titulo + '</b>' + texto);
      if (boton) {
        const b = el('button', 'btn peq', boton);
        b.type = 'button';
        b.addEventListener('click', (e) => { e.stopPropagation(); v.remove(); if (alPulsar) alPulsar(); });
        v.appendChild(b);
      }
      marco.appendChild(v);
      return v;
    };
    const fin = (ok) => {
      if (terminado) return;
      terminado = true; resultado = ok;
      if (ctx && ctx.alTerminar) ctx.alTerminar(ok);
    };
    const fallo = (mostrarSol) => {
      if (terminado) return;
      errores++;
      vidas[errores - 1] && vidas[errores - 1].classList.add('gastada');
      if (errores === 1) aviso('¡Ups!', 'Ese clic no es correcto. Puedes intentarlo una vez más.', 'Cerrar');
      else {
        fin(false);
        // En el simulacro (modoExamen) no se enseña la solución hasta la revisión final
        if (ctx && ctx.modoExamen) aviso('Pregunta respondida', 'Has fallado dos clics: esta pregunta no cuenta.', null);
        else aviso('Pregunta anulada', 'Has fallado dos clics. En el examen esta pregunta ya no cuenta.', 'Ver la solución', mostrarSol);
      }
    };
    const exito = () => {
      fin(true);
      if (ctx && ctx.modoExamen) aviso('Pregunta respondida', 'Tu respuesta se ha guardado.', null);
      else aviso('¡Correcto!', 'Has hecho la tarea bien.', null);
    };
    // Los datos escritos no son los que pide el enunciado: la pregunta cuenta como fallada
    const anula = (mostrarSol) => {
      if (terminado) return;
      errores = 2;
      vidas.forEach((v) => v.classList.add('gastada'));
      fin(false);
      if (ctx && ctx.modoExamen) aviso('Pregunta respondida', 'Tu respuesta se ha guardado.', null);
      else aviso('No es correcto', 'Lo que has escrito no coincide con lo que pide el enunciado.', 'Ver la solución', mostrarSol);
    };
    const api = { fallo, exito, anula, terminado: () => terminado, resultado: () => resultado };
    return q.html ? simHtml(marco, q, api) : simImagen(marco, q, api);
  };

  function simImagen(marco, q, api) {
    const S = CDC.sims[q.sim];
    if (!S) { marco.innerHTML = '<div class="img-slot">Falta la simulación «' + escapaHtml(q.sim) + '»</div>'; return { comprobar: () => null }; }
    const ancho = q.ancho || 880;
    marco.style.width = ancho + 'px';
    marco.style.height = Math.round(ancho * S.alto / S.ancho) + 'px';
    const img = el('img', 'pantalla');
    img.alt = q.enunciado;
    img.draggable = false;
    marco.appendChild(img);
    const valores = {};
    let actual = null;
    // precarga
    Object.values(S.pantallas).forEach((p) => { if (p.imagen) { const i = new Image(); i.src = q.base + p.imagen; } });
    const ponCampos = (p) => {
      marco.querySelectorAll('.sim-campo').forEach((c) => c.remove());
      (p.textos || []).forEach((t) => {
        const inp = el('input', 'sim-campo');
        const k = 100 / S.ancho, kh = 100 / S.alto;
        Object.assign(inp.style, { left: t.x * k + '%', top: t.y * kh + '%', width: Math.max(t.w, 300) * k + '%', height: t.h * kh + '%' });
        inp.value = valores[t.variable] || '';
        inp.addEventListener('input', () => { valores[t.variable] = inp.value; });
        inp.addEventListener('keydown', (e) => e.stopPropagation());
        inp.addEventListener('pointerdown', (e) => e.stopPropagation());
        marco.appendChild(inp);
      });
    };
    const ve = (id) => {
      const p = S.pantallas[id];
      actual = id;
      if (p.imagen) img.src = q.base + p.imagen;
      ponCampos(p);
      const terminal = p.final === 'correcto' || p.final === 'evaluar' || (!p.final && !(p.zonas || []).length);
      if (terminal) {
        if (p.final === 'evaluar' && S.esperado) {
          const ok = Object.entries(S.esperado).every(([v, vals]) => vals.some((x) => normaliza(x) === normaliza(valores[v] || '')));
          if (!ok) { api.anula(muestraSol); return; }
        }
        setTimeout(api.exito, p.imagen ? 900 : 0);
      }
    };
    const destino = (z) => z.ir.find((d) => S.pantallas[d] && S.pantallas[d].final !== 'fallo');
    const muestraSol = () => {
      const p = S.pantallas[actual];
      marco.querySelectorAll('.zona-sol').forEach((z) => z.remove());
      (p.zonas || []).forEach((z) => {
        const d = el('div', 'zona-sol');
        Object.assign(d.style, { left: z.x / S.ancho * 100 + '%', top: z.y / S.alto * 100 + '%', width: z.w / S.ancho * 100 + '%', height: z.h / S.alto * 100 + '%' });
        d.title = z.evento === 'clic-derecho' ? 'Clic derecho aquí' : 'Clic aquí';
        marco.appendChild(d);
      });
      marco.dataset.solucion = '';
    };
    const pulsa = (e, evento) => {
      if (e.target.closest('.sim-aviso, .sim-campo')) return;
      if (marco.querySelector('.sim-aviso')) return;
      const r = marco.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * S.ancho, y = (e.clientY - r.top) / r.height * S.alto;
      const p = S.pantallas[actual];
      const z = (p.zonas || []).find((z) => z.evento === evento && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h && destino(z));
      if (z) {
        marco.querySelectorAll('.zona-sol').forEach((s) => s.remove());
        ve(destino(z));
        if (marco.hasAttribute('data-solucion') && !api.terminado()) muestraSol();
        else if (marco.hasAttribute('data-solucion')) setTimeout(muestraSol, 50);
        return;
      }
      if (api.terminado()) return;
      // un clic en una zona correcta con el botón equivocado también es fallo
      api.fallo(muestraSol);
    };
    marco.addEventListener('click', (e) => pulsa(e, 'clic'));
    marco.addEventListener('contextmenu', (e) => { e.preventDefault(); pulsa(e, 'clic-derecho'); });
    ve(S.inicio);
    return { comprobar: () => api.resultado(), esSim: true };
  }

  function simHtml(marco, q, api) {
    const plantilla = document.querySelector(q.html);
    marco.classList.add('sim-html');
    marco.style.background = 'transparent';
    marco.style.boxShadow = 'none';
    marco.appendChild(plantilla.content.cloneNode(true));
    const pantallas = [...marco.querySelectorAll('.pantalla-html')];
    let solucion = false;
    const ve = (id) => {
      pantallas.forEach((p) => p.classList.toggle('activa', p.dataset.id === id));
      const p = pantallas.find((x) => x.dataset.id === id);
      if (p && p.hasAttribute('data-final')) setTimeout(api.exito, 700);
      if (solucion) marca();
    };
    const marca = () => {
      marco.querySelectorAll('.zona-sol-html').forEach((z) => z.classList.remove('zona-sol-html'));
      const p = pantallas.find((x) => x.classList.contains('activa'));
      if (p) p.querySelectorAll('[data-ir]').forEach((z) => z.classList.add('zona-sol-html'));
    };
    marco.addEventListener('click', (e) => {
      if (e.target.closest('.sim-aviso')) return;
      if (marco.querySelector('.sim-aviso')) return;
      const z = e.target.closest('[data-ir]');
      if (z && marco.contains(z)) { ve(z.dataset.ir); return; }
      if (api.terminado()) return;
      api.fallo(() => { solucion = true; marca(); });
    });
    ve(pantallas[0].dataset.id);
    return { comprobar: () => api.resultado(), esSim: true };
  }

  /* --- si al corregir (o al abrir la pista) el contenido se sale de la diapositiva, la pregunta se encoge lo justo --- */
  function ajustaAlto(w) {
    const s = w.closest('deck-stage > section');
    if (!s) return;
    requestAnimationFrame(() => {
      w.style.zoom = '';
      const sr = s.getBoundingClientRect();
      if (!sr.height) return;
      const k = sr.height / 1080, limite = 1030;
      let fondo = 0;
      s.querySelectorAll('*').forEach((e) => {
        if (e.closest('[data-slide-num], .seccion-pill')) return;
        const r = e.getBoundingClientRect();
        if (r.height) fondo = Math.max(fondo, (r.bottom - sr.top) / k);
      });
      if (fondo <= limite) return;
      const alto = w.getBoundingClientRect().height / k;
      w.style.zoom = Math.max(0.72, (alto - (fondo - limite)) / alto).toFixed(3);
    });
  }
  CDC.ajustaAlto = ajustaAlto;

  /* --- monta una pregunta completa: enunciado, interfaz, botón Comprobar y explicación --- */
  function montaPregunta(cont, q0, ctx) {
    ctx = ctx || {};
    // Las rutas relativas (imágenes, archivos de reto, pantallas de simulación) se resuelven con ctx.base,
    // para poder montar en el simulacro preguntas escritas para la carpeta de un tema
    const base = ctx.base || '';
    const ruta = (p) => (!p || /^(https?:|data:|\/)/.test(p) ? p : base + p);
    const q = Object.assign({}, q0, { base, imagen: ruta(q0.imagen), archivo: ruta(q0.archivo), imagenes: q0.imagenes && q0.imagenes.map(ruta) });
    const w = el('div', 'preg' + (q.tipo === 'simulacion' ? ' sim-dos' : '') + (q.imagen && !q.imagenArriba ? ' con-img' : ''));
    if (q.etiqueta) w.appendChild(el('span', 'pill clara', fmt(q.etiqueta)));
    w.appendChild(el('p', 'enun', fmt(q.enunciado)));
    const instr = q.instrucciones || {
      test: [].concat(q.correcta).length > 1 || q.multiple ? 'Elige todas las respuestas correctas. Puede haber más de una.' : 'Elige una única opción.',
      emparejar: 'Ordena la segunda lista para que cada elemento quede junto a su pareja. Arrastra o pulsa dos elementos para cambiarlos de sitio.',
      ordenar: 'Ordena los pasos. Arrastra o pulsa dos elementos para cambiarlos de sitio.',
      reto: 'Descarga el archivo y resuélvelo con el ordenador. Después responde.',
      simulacion: 'Haz la tarea en la pantalla. No uses atajos de teclado.',
    }[q.tipo];
    if (instr) w.appendChild(el('p', 'instr', fmt(instr)));
    if (q.imagen) { const i = el('img', 'img-enun'); i.src = q.imagen; i.alt = ''; w.appendChild(i); }
    const fb = el('div', 'fb');
    const botones = el('div', 'botones');
    const bComp = el('button', 'btn', ctx.textoComprobar || 'Comprobar');
    bComp.type = 'button';
    let terminada = false;
    const termina = (ok) => {
      if (terminada) return;
      terminada = true;
      w.setAttribute('data-corregida', '');
      fb.className = 'fb ' + (ok ? 'ok' : 'ko');
      fb.innerHTML = '<span class="fb-tit">' + (ok ? 'Correcto.' : 'No es correcto.') + '</span>' + fmt(q.explicacion || '');
      bComp.remove();
      ajustaAlto(w);
      if (ctx.alTerminar) ctx.alTerminar(ok);
      if (ctx.repetible !== false) {
        const r = el('button', 'btn sec peq', 'Repetir');
        r.type = 'button';
        r.addEventListener('click', () => { cont.innerHTML = ''; montaPregunta(cont, q0, ctx); });
        botones.appendChild(r);
      }
    };
    const ui = TIPOS[q.tipo](w, q, { alTerminar: (ok) => termina(ok), modoExamen: ctx.modoExamen });
    if (!ui.esSim) {
      bComp.addEventListener('click', () => {
        const r = ui.comprobar();
        if (r === null) { fb.className = 'fb info'; fb.innerHTML = 'Responde antes de comprobar.'; return; }
        termina(r);
      });
      botones.appendChild(bComp);
    }
    w.append(botones, fb);
    cont.appendChild(w);
    return w;
  }
  CDC.montaPregunta = montaPregunta;
  // Para el simulacro: los tipos de pregunta (cada uno devuelve { comprobar() }) y utilidades
  CDC.TIPOS = TIPOS;
  CDC.leeJSON = leeJSON;
  CDC.baraja = baraja;
  CDC.fmt = fmt;

  /* --- Comprueba: tres preguntas seguidas y resultado guardado --- */
  function montaComprueba(c) {
    const preguntas = leeJSON(c);
    const comp = c.dataset.comp;
    const tipoTxt = { test: 'Conocimientos', emparejar: 'Habilidades', ordenar: 'Habilidades', reto: 'Habilidades · reto', simulacion: 'Habilidades · simulación' };
    const empieza = () => {
      c.querySelectorAll(':scope > :not(script)').forEach((n) => n.remove());
      const cab = el('div', 'cp-cab', '<span class="pill">Comprueba ' + escapaHtml(comp) + '</span><span class="cp-puntos">' + preguntas.map(() => '<span></span>').join('') + '</span><span class="cp-tipo"></span>');
      const zona = el('div', 'cp-zona');
      c.append(cab, zona);
      const puntos = cab.querySelectorAll('.cp-puntos span');
      const res = [];
      const muestra = (k) => {
        zona.innerHTML = '';
        puntos.forEach((p, j) => p.classList.toggle('actual', j === k));
        cab.querySelector('.cp-tipo').textContent = 'Pregunta ' + (k + 1) + ' de ' + preguntas.length + ' · ' + (tipoTxt[preguntas[k].tipo] || '');
        const w = montaPregunta(zona, preguntas[k], {
          repetible: false,
          base: c.dataset.base || '',
          alTerminar: (ok) => {
            res[k] = ok;
            puntos[k].classList.remove('actual');
            puntos[k].classList.add(ok ? 'ok' : 'ko');
            const sig = el('button', 'btn', k + 1 < preguntas.length ? 'Siguiente pregunta' : 'Ver resultado');
            sig.type = 'button';
            sig.addEventListener('click', () => (k + 1 < preguntas.length ? muestra(k + 1) : final()));
            w.querySelector('.botones').appendChild(sig);
          },
        });
      };
      const final = () => {
        const aciertos = res.filter(Boolean).length, ok = aciertos === preguntas.length;
        progreso.set(comp, { ok, aciertos });
        cab.querySelector('.cp-tipo').textContent = 'Resultado';
        zona.innerHTML = '';
        const f = el('div', 'cp-final',
          '<p class="cifra">' + aciertos + ' / ' + preguntas.length + '</p>' +
          '<p class="enun">' + (ok ? 'Competencia ' + escapaHtml(comp) + ' superada.' : 'Te falta acertar ' + (preguntas.length - aciertos) + '. Repasa las diapositivas de la competencia y vuelve a intentarlo.') + '</p>' +
          '<p class="cap">El resultado se guarda en este navegador.</p>');
        const b = el('button', 'btn sec', 'Repetir el Comprueba');
        b.type = 'button';
        b.addEventListener('click', empieza);
        f.appendChild(b);
        zona.appendChild(f);
      };
      muestra(0);
    };
    empieza();
  }

  /* --- test de repaso con «Otra pregunta» --- */
  function montaRepaso(c) {
    const banco = leeJSON(c);
    let lista = baraja(banco), i = 0, aciertos = 0, hechas = 0;
    const cab = el('div', 'rt-cab', '<span class="pill">Test de repaso</span><span class="rt-cont"></span>');
    const zona = el('div', '');
    c.append(cab, zona);
    const cuenta = () => { cab.querySelector('.rt-cont').textContent = 'Pregunta ' + (i + 1) + ' de ' + lista.length + ' · aciertos: ' + aciertos + ' de ' + hechas; };
    const pon = () => {
      zona.innerHTML = '';
      cuenta();
      const w = montaPregunta(zona, lista[i], {
        repetible: false,
        base: c.dataset.base || '',
        alTerminar: (ok) => {
          hechas++; if (ok) aciertos++;
          cuenta();
          const b = el('button', 'btn', 'Otra pregunta');
          b.type = 'button';
          b.addEventListener('click', () => { i = (i + 1) % lista.length; if (i === 0) lista = baraja(banco); pon(); });
          w.querySelector('.botones').appendChild(b);
        },
      });
    };
    pon();
  }

  /* ---------- piensa: respuesta oculta ---------- */
  function montaPiensa(p) {
    const b = p.querySelector('.revela-btn');
    if (b) b.addEventListener('click', (e) => { e.stopPropagation(); p.setAttribute('data-revelado', ''); });
  }

  /* ---------- visor de fotos ---------- */
  function abreVisor(fig) {
    const img = fig.querySelector('img'), cred = fig.querySelector('.credito');
    const v = el('div', 'visor', '<img alt=""><div class="visor-pie"></div><button class="visor-cerrar" aria-label="Cerrar">×</button>');
    v.querySelector('img').src = img.currentSrc || img.src;
    if (cred) v.querySelector('.visor-pie').innerHTML = cred.innerHTML; else v.querySelector('.visor-pie').remove();
    const cierra = () => { v.remove(); document.removeEventListener('keydown', tecla, true); };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cierra(); } };
    v.addEventListener('click', (e) => { if (!e.target.closest('a')) cierra(); });
    document.addEventListener('keydown', tecla, true);
    document.body.appendChild(v);
  }
  function montaFoto(fig) {
    const img = fig.querySelector('img');
    if (img) img.addEventListener('click', (e) => { e.stopPropagation(); abreVisor(fig); });
  }

  /* ---------- buscador (tecla B) ---------- */
  function normalizaPos(s) {
    return s.split('').map((c) => { const d = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return d.length === 1 ? d : c; }).join('');
  }
  const BLOQUES = /^(P|H[1-6]|LI|UL|OL|DIV|SECTION|ASIDE|FIGURE|FIGCAPTION|TABLE|TR|TD|TH|BR|BUTTON)$/;
  function textoVisible(n0) {
    let t = '';
    n0.childNodes.forEach((n) => {
      if (n.nodeType === 3) t += n.textContent;
      else if (n.nodeType === 1) { t += textoVisible(n); if (BLOQUES.test(n.tagName)) t += ' '; }
    });
    return t;
  }
  function indiceBusqueda(stage) {
    return [...stage.querySelectorAll(':scope > section')].map((s, i) => {
      const c = s.cloneNode(true);
      c.querySelectorAll('aside.notas, .seccion-pill, [data-slide-num], script, style, template, .comprueba, .repaso-test, .preg-bloque').forEach((n) => n.remove());
      const texto = textoVisible(c).replace(/\s+/g, ' ').trim();
      const label = s.dataset.label || ('Diapositiva ' + (i + 1));
      return { i, label, texto, seccion: s.dataset.seccion || '', nLabel: normalizaPos(label), nTexto: normalizaPos(texto) };
    });
  }
  function fragmento(d, terminos) {
    let pos = -1;
    for (const t of terminos) { const p = d.nTexto.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
    if (pos < 0) return '';
    let ini = Math.max(0, pos - 60);
    if (ini > 0) { const sp = d.nTexto.lastIndexOf(' ', ini); ini = sp > 0 ? sp + 1 : ini; }
    const fin = Math.min(d.nTexto.length, ini + 190);
    const nTrozo = d.nTexto.slice(ini, fin), trozo = d.texto.slice(ini, fin);
    const marcas = new Array(nTrozo.length + 1).fill(0);
    for (const t of terminos) { let p = nTrozo.indexOf(t); while (p >= 0) { for (let k = p; k < p + t.length; k++) marcas[k] = 1; p = nTrozo.indexOf(t, p + t.length); } }
    let html = '', dentro = false;
    for (let k = 0; k < trozo.length; k++) {
      if (marcas[k] && !dentro) { html += '<mark>'; dentro = true; }
      if (!marcas[k] && dentro) { html += '</mark>'; dentro = false; }
      html += escapaHtml(trozo[k]);
    }
    if (dentro) html += '</mark>';
    return (ini > 0 ? '… ' : '') + html + (fin < d.nTexto.length ? ' …' : '');
  }
  function buscaEn(indice, q) {
    const terminos = normalizaPos(q).split(/\s+/).filter(Boolean);
    if (!terminos.length) return [];
    const res = [];
    indice.forEach((d) => {
      let puntos = 0;
      for (const t of terminos) {
        const enL = d.nLabel.indexOf(t) >= 0, enT = d.nTexto.indexOf(t) >= 0;
        if (!enL && !enT) { puntos = -1; break; }
        puntos += enL ? 10 : 1;
      }
      if (puntos > 0) res.push({ d, puntos });
    });
    res.sort((a, b) => b.puntos - a.puntos || a.d.i - b.d.i);
    return res.slice(0, 40).map((r) => Object.assign({ frag: fragmento(r.d, terminos) }, r.d));
  }
  let panelBusqueda = null;
  function abreBuscador(stage) {
    if (panelBusqueda) { panelBusqueda.querySelector('input').focus(); return; }
    if (!stage.__indice) stage.__indice = indiceBusqueda(stage);
    const indice = stage.__indice;
    const p = el('div', 'buscador',
      '<div class="buscador-caja"><div class="buscador-cabecera"><input type="text" autocomplete="off" spellcheck="false" placeholder="Buscar en este tema…" aria-label="Buscar en este tema">' +
      '<button type="button" class="buscador-cerrar" aria-label="Cerrar">×</button></div><ol class="buscador-lista" hidden></ol><p class="buscador-vacio"></p>' +
      '<div class="buscador-pie"><span><kbd>↑</kbd><kbd>↓</kbd>moverse</span><span><kbd>Enter</kbd>ir a la diapositiva</span><span><kbd>Esc</kbd>cerrar</span></div></div>');
    p.setAttribute('role', 'dialog');
    const input = p.querySelector('input'), lista = p.querySelector('.buscador-lista'), vacio = p.querySelector('.buscador-vacio');
    let resultados = [], sel = 0;
    const cierra = () => { p.remove(); panelBusqueda = null; };
    const marca = () => { [...lista.children].forEach((li, k) => li.toggleAttribute('data-sel', k === sel)); const li = lista.children[sel]; if (li) li.scrollIntoView({ block: 'nearest' }); };
    const ve = (k) => { const r = resultados[k]; if (!r) return; cierra(); stage.goTo(r.i); };
    const pinta = () => {
      const q = input.value.trim();
      resultados = q ? buscaEn(indice, q) : [];
      sel = 0;
      lista.innerHTML = resultados.map((r) => '<li><span class="b-num">' + String(r.i + 1).padStart(2, '0') + '</span><span class="b-titulo">' +
        (r.seccion ? '<span class="b-pill">' + escapaHtml(r.seccion) + '</span>' : '') + escapaHtml(r.label) + '</span>' + (r.frag ? '<p class="b-frag">' + r.frag + '</p>' : '') + '</li>').join('');
      lista.hidden = !resultados.length;
      vacio.hidden = !!resultados.length;
      vacio.textContent = !q ? 'Escribe para buscar en las ' + indice.length + ' diapositivas de este tema.' : 'No hay nada en este tema para «' + q + '».';
      marca();
    };
    input.addEventListener('input', pinta);
    p.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); cierra(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (resultados.length) { sel = (sel + 1) % resultados.length; marca(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (resultados.length) { sel = (sel - 1 + resultados.length) % resultados.length; marca(); } }
      else if (e.key === 'Enter') { e.preventDefault(); ve(sel); }
    });
    lista.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) ve([...lista.children].indexOf(li)); });
    p.querySelector('.buscador-cerrar').addEventListener('click', cierra);
    p.addEventListener('click', (e) => { if (e.target === p) cierra(); });
    document.body.appendChild(p);
    panelBusqueda = p;
    pinta();
    input.focus();
  }
  function montaBuscador(stage) {
    const overlay = stage.shadowRoot && stage.shadowRoot.querySelector('.overlay');
    if (overlay && !overlay.querySelector('.buscar')) {
      const sep = el('span', 'divider');
      const b = el('button', 'btn buscar', 'Buscar');
      b.type = 'button'; b.title = 'Buscar en este tema (B)';
      b.addEventListener('click', () => abreBuscador(stage));
      overlay.append(sep, b);
    }
    window.addEventListener('keydown', (e) => {
      if ((e.key !== 'b' && e.key !== 'B') || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      abreBuscador(stage);
    });
  }

  /* ---------- Inicio, pastilla de sección y numeración ---------- */
  function montaVolver(stage) {
    const overlay = stage.shadowRoot && stage.shadowRoot.querySelector('.overlay');
    if (overlay && !overlay.querySelector('.inicio')) {
      const sep = el('span', 'divider');
      const a = el('a', 'btn inicio', 'Inicio');
      a.href = '../'; a.title = 'Volver a la portada del curso';
      a.style.cssText = 'color:inherit;text-decoration:none;cursor:pointer;padding:0 10px';
      overlay.append(sep, a);
    }
    const secs = [...stage.querySelectorAll(':scope > section')];
    let idx = secs.findIndex((s) => /^índice/i.test(s.dataset.label || ''));
    if (idx < 0) idx = Math.min(1, secs.length - 1);
    secs.forEach((s) => {
      if (!s.dataset.seccion || s.querySelector(':scope > .seccion-pill')) return;
      const b = el('button', 'seccion-pill', escapaHtml(s.dataset.seccion));
      b.type = 'button'; b.title = 'Ir al índice del tema';
      b.addEventListener('click', (e) => { e.stopPropagation(); stage.goTo(idx); });
      s.appendChild(b);
    });
  }
  function numera(stage) {
    const secs = [...stage.querySelectorAll(':scope > section')];
    secs.forEach((s, i) => {
      if (s.querySelector('[data-slide-num]') || s.classList.contains('portada')) return;
      const n = el('span', '', String(i + 1).padStart(2, '0') + ' / ' + secs.length);
      n.setAttribute('data-slide-num', '');
      if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
      s.appendChild(n);
    });
  }

  /* ---------- maqueta estática de móvil: una pantalla de una plantilla de simulación HTML ----------
       <div class="maqueta-movil" data-plantilla="#wa-privacidad" data-pantalla="privacidad"></div> */
  function montaMaqueta(m) {
    const t = document.querySelector(m.dataset.plantilla);
    if (!t) return;
    m.appendChild(t.content.cloneNode(true));
    m.querySelectorAll('.pantalla-html').forEach((p) => p.classList.toggle('activa', p.dataset.id === m.dataset.pantalla));
  }

  function init() {
    document.querySelectorAll('.maqueta-movil').forEach(montaMaqueta);
    document.querySelectorAll('.preg-bloque').forEach((c) => montaPregunta(c, leeJSON(c), { base: c.dataset.base || '' }));
    document.querySelectorAll('.comprueba[data-comp]').forEach(montaComprueba);
    document.querySelectorAll('.repaso-test').forEach(montaRepaso);
    document.querySelectorAll('.piensa').forEach(montaPiensa);
    document.querySelectorAll('.foto').forEach(montaFoto);
    pintaEstados();
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    numera(stage);
    customElements.whenDefined('deck-stage').then(() => { montaBuscador(stage); montaVolver(stage); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
