/*
  Silk 3D: one ribbon of translucent silk with glowing threads, built as real 3D geometry,
  running the full length of the page and twisting through space.

  - The world is built at page scale (1 unit = 1 CSS px at depth 0) and the camera follows
    window.scrollY, so the ribbon scrolls with the content 1:1. Parts that swing closer to the
    camera move faster than parts further away: real depth parallax, not a flat picture.
  - The canvas lives IN the page (not fixed to the screen) and is a little taller than the screen.
    The browser scrolls it together with the text on its own thread, so between two drawings the
    silk already moves with the page. A fixed canvas stayed put until the next drawing, which is
    what made the ribbon shake against the content while scrolling.
  - Only the stretch of ribbon around the screen is built, and it is sampled every few pixels, so
    the curves and threads are smoother than before with fewer vertices. The samples are snapped
    to fixed page positions, so the threads do not shimmer as you scroll.
  - Cheap by construction: every vertex is placed on the GPU from a few uniforms, so a frame is
    four draw calls. When nothing scrolls, the slow drift is drawn at 30 fps.
  - Readable: the ribbon fades behind the text column in the middle of the screen.
  - Safe: no WebGL means the pre-rendered silk images stay; reduced motion stops the drift but
    keeps it scrolling with the page; hidden tabs stop rendering; slow devices drop resolution.
*/
(function () {
  const doc = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = () => window.innerWidth < 760;
  const touch = window.matchMedia('(pointer: coarse)').matches;

  const cv = document.createElement('canvas');
  cv.className = 'silk3d';
  cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, powerPreference: 'default' });
  if (!gl) return; // the CSS silk images remain as the background
  document.body.prepend(cv);
  doc.classList.add('has-silk3d');

  // ---------- geometry: u = along the visible stretch (0..1), s = across the ribbon (0..1) ----------
  const STEP = small() ? 8 : 7;         // px of page between samples along the ribbon
  const THREADS = small() ? 22 : 34;    // glowing threads on the silk
  const ACROSS = small() ? 8 : 10;      // sheet subdivisions across the width
  const PAD = 0.25;                     // canvas reaches this many screens above and below the view
  let SEG = 0, sheet = null, threads = null;

  function buildSheet(n) {
    const v = new Float32Array(n * ACROSS * 12);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      for (let j = 0; j < ACROSS; j++) {
        const s0 = j / ACROSS, s1 = (j + 1) / ACROSS;
        v.set([u0, s0, u1, s0, u0, s1, u0, s1, u1, s0, u1, s1], k); k += 12;
      }
    }
    return v;
  }
  function buildThreads(n) {
    const v = new Float32Array(THREADS * n * 4);
    let k = 0;
    for (let t = 0; t < THREADS; t++) {
      const s = (t + 0.5) / THREADS;
      for (let i = 0; i < n; i++) { v[k++] = i / n; v[k++] = s; v[k++] = (i + 1) / n; v[k++] = s; } // GL_LINES pairs
    }
    return v;
  }

  // ---------- shaders ----------
  const VS = `
attribute vec2 a;              // (u, s)
uniform vec2 uView;            // width, screen height (CSS px)
uniform vec2 uCanvas;          // canvas top on the page, canvas height (CSS px)
uniform float uCam, uY0, uSpan, uTime, uFocal, uWidth, uMode, uSeed;
varying float vFace, vS;
float th(float x){ float e = exp(2.4 * x); return (e - 1.0 / e) / (e + 1.0 / e) / 0.984; } // tanh, normalised
void main(){
  float y = uY0 + a.x * uSpan;                           // page Y in px
  float W = uView.x;
  // the path rests near one edge, then sweeps through space to the other
  float sw = sin(y / 980.0 + 0.6 + uSeed + uTime * 0.03);
  float cx = W * 0.39 * th(sw);
  float cz = 260.0 * sin(y / 760.0 + uSeed * 1.7 + uTime * 0.05);      // swings towards and away from the camera
  float tw = y / 430.0 + uSeed * 2.3 + uTime * 0.28;                   // twist along the ribbon
  float s = a.y - 0.5;
  float wid = uWidth * (0.8 + 0.2 * sin(y / 610.0 + 1.3));
  vec3 across = vec3(cos(tw), 0.18 * sin(tw * 0.5), sin(tw));
  vec3 p = vec3(cx, -y, cz) + across * s * wid;
  p.y += 14.0 * sin(y / 150.0 + a.y * 6.0 + uTime * 0.6) * uMode; // threads ripple a little
  // camera at the middle of the screen; depth 0 maps 1:1 to CSS px
  vec3 v = p - vec3(0.0, -uCam, uFocal);
  float w = -v.z;
  float pageY = uCam - v.y * uFocal / w;                  // where this point lands on the page
  gl_Position = vec4(v.x * 2.0 * uFocal / (W * w), (uCanvas.x + uCanvas.y * 0.5 - pageY) / (uCanvas.y * 0.5), 0.0, 1.0);
  vFace = abs(cos(tw));                                   // 1 = silk facing the viewer
  vS = a.y;
}`;
  const FS = `
precision mediump float;
uniform vec2 uRes;
uniform float uKind, uAlpha;   // uKind mirrors uMode (separate name: uniforms shared across stages must match precision)
uniform vec3 uC1, uC2, uShade, uPearl;
varying float vFace, vS;
void main(){
  vec3 body = mix(uC1, uC2, vS);
  vec3 c = mix(uShade, body, smoothstep(0.1, 0.8, vFace));
  float edge = smoothstep(0.32, 0.5, abs(vS - 0.5));      // sheet glows at its edges
  float a;
  if (uKind < 0.5) {                                        // translucent sheet
    a = (0.09 + 0.2 * vFace + 0.38 * edge);
    c = mix(c, uPearl, 0.45 * edge * vFace);
  } else {                                                  // threads
    a = 0.45 + 0.55 * vFace;
    c = mix(c, uPearl, 0.6 * vFace * vFace);
  }
  float side = abs(gl_FragCoord.x / uRes.x - 0.5);          // calm behind the text column
  a *= mix(0.18, 1.0, smoothstep(0.14, 0.40, side)) * uAlpha;
  gl_FragColor = vec4(c * a, a);
}`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { cv.remove(); doc.classList.remove('has-silk3d'); return; }
  gl.useProgram(prog);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  const upload = (old, data) => { const b = old ? old.b : gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return { b, n: data.length / 2 }; };
  const U = {};
  ['uView', 'uCanvas', 'uCam', 'uY0', 'uSpan', 'uTime', 'uFocal', 'uWidth', 'uMode', 'uKind', 'uSeed', 'uRes', 'uAlpha', 'uC1', 'uC2', 'uShade', 'uPearl'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
  gl.enable(gl.BLEND);

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const PAL = {
    dark: { c1: hex('#3FD6FF'), c2: hex('#3D6BFF'), shade: hex('#6A35F0'), pearl: hex('#EAF6FF'), alpha: 1.0, additive: true },
    light: { c1: hex('#0E86C9'), c2: hex('#2F5BFB'), shade: hex('#6A3BE0'), pearl: hex('#9DC6FF'), alpha: 0.75, additive: false },
  };

  // ---------- size: decided per width, so a phone's address bar showing or hiding changes nothing ----------
  let dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5);
  let W = 0, VH = 0, H = 0, pageH = 1, span = 0, half = 0;
  function measurePage() { pageH = Math.max(document.body.offsetHeight, 1); }
  function resize(force) {
    const w = doc.clientWidth;
    if (!force && w === W) { measurePage(); return; }
    W = w; VH = window.innerHeight;
    H = Math.round(VH * (1 + 2 * PAD));
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
    // build enough ribbon to cover the canvas even for the parts far from the camera
    half = VH * 1.7;
    const seg = Math.ceil((half * 2) / STEP);
    if (seg !== SEG) { SEG = seg; sheet = upload(sheet, buildSheet(SEG)); threads = upload(threads, buildThreads(SEG)); }
    span = SEG * STEP;
    measurePage();
  }

  const t0 = performance.now();
  let lastTop = null;
  function draw(now) {
    const pal = PAL[doc.dataset.theme === 'light' ? 'light' : 'dark'];
    const sy = window.scrollY;
    // the canvas sits around the screen, but never past the end of the page
    const top = Math.round(Math.max(0, Math.min(sy - VH * PAD, pageH - H)));
    if (top !== lastTop) { lastTop = top; cv.style.transform = `translate3d(0, ${top}px, 0)`; }
    const cam = sy + VH * 0.5;
    gl.blendFunc(gl.ONE, pal.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uView, W, VH);
    gl.uniform2f(U.uCanvas, top, H);
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform1f(U.uCam, cam);
    gl.uniform1f(U.uY0, Math.floor((cam - half) / STEP) * STEP); // snapped: samples stay put on the page
    gl.uniform1f(U.uSpan, span);
    gl.uniform1f(U.uTime, reduced ? 0 : (now - t0) / 1000);
    gl.uniform1f(U.uFocal, VH * 1.2); // camera distance: depth 0 is 1:1 with the page
    gl.uniform3fv(U.uC1, pal.c1); gl.uniform3fv(U.uC2, pal.c2); gl.uniform3fv(U.uShade, pal.shade); gl.uniform3fv(U.uPearl, pal.pearl);
    // the main ribbon, and a thinner one weaving on the opposite side
    for (const [seed, width, alpha] of [[0, small() ? 180 : 320, 1], [Math.PI, small() ? 110 : 190, 0.7]]) {
      gl.uniform1f(U.uSeed, seed);
      gl.uniform1f(U.uWidth, width);
      gl.uniform1f(U.uAlpha, pal.alpha * alpha * (small() ? 0.75 : 1)); // phones: text spans the whole width
      for (const [buf, mode, prim] of [[sheet, 0, gl.TRIANGLES], [threads, 1, gl.LINES]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(U.uMode, mode); gl.uniform1f(U.uKind, mode);
        gl.drawArrays(prim, 0, buf.n);
      }
    }
  }

  // ---------- loop: rAF only (never draw inside scroll events), adaptive quality ----------
  // While the page scrolls every frame is drawn; when it is still, the slow drift is drawn at 30 fps.
  // If a device keeps missing frames the canvas renders fewer pixels; as a last resort the silk
  // hands over to the pre-rendered images rather than slow the page.
  let raf = 0, slow = 0, frames = 0, lastT = 0, dirty = true, level = 0, dead = false, lastY = -1, wasMoving = false;
  function stepDown() {
    level++;
    if (level === 1 && dpr > 1) { dpr = 1; resize(true); }
    else if (level <= 2) { level = 2; dpr = 0.75; resize(true); }
    else { dead = true; cancelAnimationFrame(raf); cv.remove(); doc.classList.remove('has-silk3d'); }
  }
  function loop(now) {
    raf = 0;
    if (document.hidden || dead) return;
    const y = window.scrollY;
    const moving = y !== lastY || dirty;
    lastY = y;
    if (moving || !reduced) { draw(now); dirty = false; }
    // frame times are only judged while frames come back to back (scrolling); the still page is paced on purpose
    const timed = wasMoving && moving;
    wasMoving = moving;
    if (!timed) { lastT = 0; }
    if (lastT && now - t0 > 2500) { // the first seconds of a page load are always busy: not counted
      const dt = now - lastT; frames++;
      if (dt > 40) slow++;
      if (frames === 90) { // every ~1.5 s: if a third of the frames were slow, render lighter
        if (slow > 30) stepDown();
        frames = 0; slow = 0;
      }
    }
    lastT = now;
    if (reduced || dead) return;
    // Still page: ask for the next frame a little later, so the browser is not woken on every
    // screen refresh (each wake also restyles every running animation). Scrolling: every frame.
    if (moving) raf = requestAnimationFrame(loop);
    else { raf = -1; idleT = setTimeout(() => { raf = requestAnimationFrame(loop); }, 26); }
  }
  let idleT = 0;
  const kick = () => {
    if (dead) return;
    if (raf === -1) { clearTimeout(idleT); raf = 0; }
    if (!raf) raf = requestAnimationFrame(loop);
  };

  resize(true);
  requestAnimationFrame(t => { draw(t); cv.classList.add('is-on'); });
  window.addEventListener('scroll', () => { dirty = true; kick(); }, { passive: true });
  window.addEventListener('resize', () => { resize(); dirty = true; kick(); }, { passive: true });
  window.addEventListener('load', () => { measurePage(); dirty = true; kick(); });
  document.addEventListener('visibilitychange', () => { lastT = 0; frames = 0; slow = 0; dirty = true; kick(); });
  new MutationObserver(() => { dirty = true; kick(); }).observe(doc, { attributes: true, attributeFilter: ['data-theme'] });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measurePage(); dirty = true; kick(); }).observe(document.body);
  kick();
})();
