/*
  Silk 3D: one ribbon of translucent silk with glowing threads, built as real 3D geometry,
  running the full length of the page and twisting through space.

  - The world is built at page scale (1 unit = 1 CSS px at depth 0) and the camera follows
    window.scrollY, so the ribbon scrolls with the content 1:1. Parts that swing closer to the
    camera move faster than parts further away: real depth parallax, not a flat picture.
  - Cheap by construction: every vertex is placed on the GPU from a few uniforms, so a frame is
    two draw calls and no per-pixel loops. JavaScript only updates time and scroll.
  - Readable: the ribbon fades behind the text column in the middle of the screen.
  - Safe: no WebGL means the pre-rendered silk images stay; reduced motion stops the drift but
    keeps it scrolling with the page; hidden tabs stop rendering; slow devices drop resolution.
*/
(function () {
  const doc = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = () => window.innerWidth < 760;
  // Phones and tablets get a lighter build: fewer pixels, less geometry, half the frame rate.
  // The silk drifts slowly, so 30 fps looks the same and leaves the phone free to scroll.
  const lite = small() || window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;

  const cv = document.createElement('canvas');
  cv.className = 'silk3d';
  cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: !lite, depth: false, stencil: false, powerPreference: lite ? 'low-power' : 'default' });
  if (!gl) return; // the CSS silk images remain as the background
  document.body.prepend(cv);
  doc.classList.add('has-silk3d');

  // ---------- geometry: u = along the ribbon (0..1 over the page), s = across it (0..1) ----------
  const SEG = lite ? 300 : 520;                      // samples along the page
  const THREADS = lite ? (small() ? 14 : 20) : 34;   // glowing threads on the silk
  const ACROSS = lite ? 6 : 10;                      // sheet subdivisions across the width

  function buildSheet() {
    const v = [];
    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG, u1 = (i + 1) / SEG;
      for (let j = 0; j < ACROSS; j++) {
        const s0 = j / ACROSS, s1 = (j + 1) / ACROSS;
        v.push(u0, s0, u1, s0, u0, s1, u0, s1, u1, s0, u1, s1);
      }
    }
    return new Float32Array(v);
  }
  function buildThreads() {
    const v = [];
    for (let k = 0; k < THREADS; k++) {
      const s = (k + 0.5) / THREADS;
      for (let i = 0; i < SEG; i++) v.push(i / SEG, s, (i + 1) / SEG, s); // GL_LINES pairs
    }
    return new Float32Array(v);
  }

  // ---------- shaders ----------
  const VS = `
attribute vec2 a;              // (u, s)
uniform vec2 uView;            // viewport, CSS px
uniform float uScroll, uPage, uTime, uFocal, uWidth, uMode, uSeed;
varying float vFace, vS, vU;
const float PI = 3.14159265;
float th(float x){ float e = exp(2.4 * x); return (e - 1.0 / e) / (e + 1.0 / e) / 0.984; } // tanh, normalised
void main(){
  float y = -300.0 + a.x * (uPage + 600.0);              // page Y in px
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
  // camera follows the scroll; depth 0 maps 1:1 to CSS px
  vec3 v = p - vec3(0.0, -(uScroll + uView.y * 0.5), uFocal);
  float w = -v.z;
  gl_Position = vec4(v.x * 2.0 * uFocal / (W * w), v.y * 2.0 * uFocal / (uView.y * w), 0.0, 1.0);
  vFace = abs(cos(tw));                                   // 1 = silk facing the viewer
  vS = a.y; vU = a.x;
}`;
  const FS = `
precision mediump float;
uniform vec2 uRes;
uniform float uKind, uAlpha;   // uKind mirrors uMode (separate name: uniforms shared across stages must match precision)
uniform vec3 uC1, uC2, uShade, uPearl;
varying float vFace, vS, vU;
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
  const mk = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return { b, n: data.length / 2 }; };
  const sheet = mk(buildSheet());
  const threads = mk(buildThreads());
  const U = {};
  ['uView', 'uScroll', 'uPage', 'uTime', 'uFocal', 'uWidth', 'uMode', 'uKind', 'uSeed', 'uRes', 'uAlpha', 'uC1', 'uC2', 'uShade', 'uPearl'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
  gl.enable(gl.BLEND);

  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const PAL = {
    dark: { c1: hex('#3FD6FF'), c2: hex('#3D6BFF'), shade: hex('#6A35F0'), pearl: hex('#EAF6FF'), alpha: 1.0, additive: true },
    light: { c1: hex('#0E86C9'), c2: hex('#2F5BFB'), shade: hex('#6A3BE0'), pearl: hex('#9DC6FF'), alpha: 0.75, additive: false },
  };

  let dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
  let pageH = 1, cssW = 0, cssH = 0;
  // The canvas is 100vh tall, which does not change when a phone's address bar hides or shows,
  // so those "resize" events no longer reallocate the drawing buffer. force = quality changed.
  function resize(force) {
    const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
    pageH = document.documentElement.scrollHeight;
    if (!force && w === cssW && h === cssH) return;
    cssW = w; cssH = h;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
  }

  const t0 = performance.now();
  function draw(now) {
    const pal = PAL[doc.dataset.theme === 'light' ? 'light' : 'dark'];
    const w = cssW, h = cssH;
    const focal = h * 1.2; // camera distance: depth 0 is 1:1 with the page
    gl.blendFunc(gl.ONE, pal.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uView, w, h);
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform1f(U.uScroll, window.scrollY);
    gl.uniform1f(U.uPage, pageH);
    gl.uniform1f(U.uTime, reduced ? 0 : (now - t0) / 1000);
    gl.uniform1f(U.uFocal, focal);
    gl.uniform3fv(U.uC1, pal.c1); gl.uniform3fv(U.uC2, pal.c2); gl.uniform3fv(U.uShade, pal.shade); gl.uniform3fv(U.uPearl, pal.pearl);
    // the main ribbon, and a thinner one weaving on the opposite side
    for (const [seed, width, alpha] of [[0, small() ? 180 : 320, 1], [Math.PI, small() ? 110 : 190, 0.7]]) {
      gl.uniform1f(U.uSeed, seed);
      gl.uniform1f(U.uWidth, width);
      gl.uniform1f(U.uAlpha, pal.alpha * alpha * (small() ? 0.75 : 1)); // phones: text spans the whole width
      for (const [buf, mode, prim] of [[sheet, 0, gl.TRIANGLES], [threads, 1, gl.LINES]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(U.uMode, mode); gl.uniform1f(U.uKind, mode);
        gl.drawArrays(prim, 0, buf.n);
      }
    }
  }

  // ---------- loop: rAF only (never draw inside scroll events), adaptive quality ----------
  // Quality steps down while the device keeps missing frames, and the silk switches itself off
  // rather than slow the page: 0 = full, 1 = fewer pixels, 2 = fewer still, 3 = off.
  let raf = 0, slow = 0, frames = 0, lastT = 0, dirty = true, tick = 0, level = 0, dead = false;
  function stepDown() {
    level++;
    if (level === 1 && dpr > 1) { dpr = 1; resize(true); }
    else if (level <= 2) { level = 2; dpr = 0.66; resize(true); }
    else { dead = true; cv.remove(); doc.classList.remove('has-silk3d'); }
  }
  function loop(now) {
    raf = 0;
    if (document.hidden || dead) return;
    tick++;
    // lite: draw every second frame (the camera still follows the scroll closely enough at 30 fps)
    if ((!reduced || dirty) && (!lite || tick % 2 === 0 || reduced)) { draw(now); dirty = false; }
    if (lastT && now - t0 > 2500) { // the first seconds of a page load are always busy: not counted
      const dt = now - lastT; frames++;
      if (dt > 40) slow++;
      if (frames === 90) { // every ~1.5 s: if a third of the frames were slow, render lighter
        if (slow > 30) stepDown();
        frames = 0; slow = 0;
      }
    }
    lastT = now;
    if (!reduced && !dead) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(loop); };

  resize(true);
  requestAnimationFrame(t => { draw(t); cv.classList.add('is-on'); });
  window.addEventListener('scroll', () => { dirty = true; kick(); }, { passive: true });
  window.addEventListener('resize', () => { resize(); dirty = true; kick(); }, { passive: true });
  window.addEventListener('load', () => { pageH = document.documentElement.scrollHeight; dirty = true; kick(); });
  document.addEventListener('visibilitychange', () => { lastT = 0; frames = 0; slow = 0; dirty = true; kick(); });
  new MutationObserver(() => { dirty = true; kick(); }).observe(doc, { attributes: true, attributeFilter: ['data-theme'] });
  if ('ResizeObserver' in window) new ResizeObserver(() => { pageH = document.documentElement.scrollHeight; }).observe(document.body);
  kick();
})();
