/*
  The thread: one silk ribbon of light that runs the full length of the page, winding from one
  side to the other between sections, the "from idea to digital experience" line made visible.

  It is drawn in page coordinates, so it scrolls with the content 1:1, like part of the page.
  Silk shading: a pearl highlight on the strands facing the viewer, cyan/azure body, iris shadow.
  Readability: the ribbon glows at the screen edges and fades to a whisper through the middle,
  where the text column sits, and it never gets brighter than a capped glow.

  Plain WebGL (no library) so every page can load it. Removes itself without WebGL, holds still
  (but still scrolls with the page) for reduced motion, and pauses in hidden tabs.
*/
(function () {
  const doc = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.innerWidth < 760;

  const cv = document.createElement('canvas');
  cv.className = 'bg-ribbons';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) { cv.remove(); return; }

  const N = small ? 12 : 18; // strands in the main ribbon
  const M = small ? 6 : 9;   // strands in the thin companion ribbon
  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
precision highp float;
#define N ${N}
#define M ${M}
uniform vec2 uView;        // viewport in CSS px
uniform float uScale;      // canvas px per CSS px
uniform float uScroll;     // window.scrollY in CSS px
uniform float uTime, uAlpha, uSmall;
uniform vec3 uPearl, uC1, uC2, uShade;

// one ribbon running down the page; returns premultiplied colour + coverage
vec4 ribbon(vec2 p, float W, float t, int count, float swing, float width, float period, float seed, float gain){
  vec3 col = vec3(0.0); float a = 0.0;
  float y = p.y;                                   // page Y in CSS px
  // the path winds from side to side as you go down the page
  // it rests along one edge, then sweeps across the page to the other (tanh squares the sine off)
  float sw = sin(y / period + seed + t * 0.05);
  float cx = W * (0.5 + swing * (exp(2.6 * sw) - exp(-2.6 * sw)) / (exp(2.6 * sw) + exp(-2.6 * sw)) / 0.989);
  for (int i = 0; i < N; i++) {
    if (i >= count) break;
    float fi = float(i) / float(count - 1);
    float tw = y / (period * 0.32) + t * 0.35 + fi * 1.25 + seed;      // twist along the ribbon
    float spread = (fi - 0.5) * width * (0.78 + 0.22 * sin(y / (period * 0.55) + seed));
    float x = cx + spread * cos(tw) + 10.0 * sin(y / 140.0 + fi * 2.1 + t * 0.4);
    float face = 0.5 + 0.5 * sin(tw);              // 1 = strand turned towards the viewer
    float w = mix(0.7, 2.4, face);
    float d = p.x - x;
    float core = (w * w) / (d * d + w * w);
    float halo = 0.55 * w / (abs(d) + 16.0);
    vec3 body = mix(uC1, uC2, smoothstep(0.0, 1.0, fi + 0.25 * sin(y / period + seed)));
    vec3 c = mix(uShade, body, smoothstep(0.0, 0.7, face));          // silk: shadowed strands sink into iris
    c = mix(c, uPearl, core * face * face * 0.85);                    // pearl highlight on the facing cores
    float k = (core + halo) * (0.25 + 0.75 * face) * gain;
    col += c * k; a += k;
  }
  return vec4(col, a);
}

void main(){
  vec2 frag = gl_FragCoord.xy / uScale;            // CSS px, y up
  float W = uView.x;
  vec2 p = vec2(frag.x, uScroll + (uView.y - frag.y));   // page coordinates, y down
  float t = uTime;
  float width = mix(230.0, 120.0, uSmall);
  vec4 r = ribbon(p, W, t, N, mix(0.41, 0.42, uSmall), width, mix(900.0, 700.0, uSmall), 0.0, 1.0)
         + ribbon(p, W, t, M, mix(0.44, 0.44, uSmall), width * 0.45, mix(1300.0, 1000.0, uSmall), 2.4, 0.6);
  // readability: full glow near the screen edges, a whisper through the text column
  float side = abs(frag.x / W - 0.5);
  float read = mix(mix(0.16, 0.10, uSmall), 1.0, smoothstep(0.17, 0.42, side));
  // calm behind the fixed menu bar
  float top = smoothstep(0.0, 90.0, uView.y - frag.y);
  float al = clamp(r.a * uAlpha * read * top, 0.0, 0.7);
  vec3 col = min(r.rgb * uAlpha * read * top, vec3(al));
  gl_FragColor = vec4(col, al);
}`;

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { cv.remove(); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  ['uView', 'uScale', 'uScroll', 'uTime', 'uAlpha', 'uSmall', 'uPearl', 'uC1', 'uC2', 'uShade'].forEach(n => { u[n] = gl.getUniformLocation(prog, n); });

  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const PAL = {
    // dark: pearl-white sheen, ice-cyan to azure body, iris in the folds
    dark: { pearl: hex('#E6F4FF'), c1: hex('#3FD6FF'), c2: hex('#3D6BFF'), shade: hex('#5B2EE8'), alpha: 1.35 },
    // light: the same silk, deeper so it reads on pale paper without glare
    light: { pearl: hex('#7FB9FF'), c1: hex('#1592D6'), c2: hex('#2F5BFB'), shade: hex('#6A3BE0'), alpha: 0.8 },
  };

  const scale = small ? 0.6 : 0.8; // soft light: render below CSS resolution to keep it cheap
  function resize() {
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  }

  const t0 = performance.now();
  let raf = 0, last = 0;
  function draw(now) {
    const pal = PAL[doc.dataset.theme === 'light' ? 'light' : 'dark'];
    gl.uniform2f(u.uView, cv.width / scale, cv.height / scale);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uScroll, window.scrollY);
    gl.uniform1f(u.uTime, reduced ? 0 : (now - t0) / 1000);
    gl.uniform1f(u.uAlpha, pal.alpha);
    gl.uniform1f(u.uSmall, small ? 1 : 0);
    gl.uniform3fv(u.uPearl, pal.pearl); gl.uniform3fv(u.uC1, pal.c1); gl.uniform3fv(u.uC2, pal.c2); gl.uniform3fv(u.uShade, pal.shade);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    if (now - last > 15) { last = now; draw(now); }
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };

  resize(); draw(performance.now());
  requestAnimationFrame(() => cv.classList.add('is-on'));
  window.addEventListener('resize', () => { resize(); draw(performance.now()); }, { passive: true });
  // drawn straight from scrollY on every scroll event, so the thread moves with the page frame for frame
  window.addEventListener('scroll', () => draw(performance.now()), { passive: true });
  document.addEventListener('visibilitychange', start);
  new MutationObserver(() => draw(performance.now())).observe(doc, { attributes: true, attributeFilter: ['data-theme'] });
  start();
})();
