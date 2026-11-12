/*
  Silk ribbons: a fixed WebGL background of glowing light strands in the brand colours
  (cyan -> azure -> iris). The strands drift on their own and twist, turn and sweep as the
  visitor scrolls, so the background travels down the page with them.
  Plain WebGL (no library) so every page can load it. Falls back to nothing if WebGL is missing,
  renders a still frame (moving only with scroll) for reduced motion, and pauses in hidden tabs.
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

  const N = small ? 14 : 22; // strands per ribbon
  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
precision highp float;
#define N ${N}
uniform vec2 uRes;
uniform float uTime, uScroll, uAlpha;
uniform vec3 uC1, uC2, uC3;
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec4 ribbon(vec2 p, float ph, float amp, float width, float seed){
  vec3 col = vec3(0.0); float a = 0.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i) / float(N - 1);
    float x = p.x;
    float c = amp * (0.62 * sin(x * 1.25 + ph) + 0.28 * sin(x * 2.6 - ph * 1.3 + seed));
    float tw = x * 1.9 + ph * 0.9 + fi * 1.4 + seed;          // twist along the ribbon
    float spread = (fi - 0.5) * width * (0.72 + 0.28 * sin(x * 0.8 + ph * 0.6 + seed));
    float y = c + spread * cos(tw);
    float depth = 0.5 + 0.5 * sin(tw);                          // strands turned towards us glow more
    float w = mix(0.0011, 0.0042, depth);
    float d = p.y - y;
    float core = (w * w) / (d * d + w * w);
    float halo = 0.012 * w / (abs(d) + 0.018);
    float k = (core + halo) * (0.3 + 0.7 * depth);
    vec3 cc = mix(mix(uC1, uC2, fi), uC3, smoothstep(-1.1, 1.3, x + fi * 0.5));
    col += cc * k; a += k;
  }
  return vec4(col, a);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float ar = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5) * ar, uv.y - 0.5);
  float s = uScroll;
  p = rot(-0.38 + s * 1.1) * p;                 // the sweep turns as you scroll
  p.y += 0.10 * sin(s * 6.2831);
  float ph = uTime * 0.2 + s * 6.0;
  vec4 r = ribbon(p, ph, 0.2, 0.3, 0.0) + 0.55 * ribbon(p + vec2(0.0, 0.2), ph * 0.8 + 2.0, 0.14, 0.17, 2.3);
  float vign = smoothstep(1.3, 0.15, length(p * vec2(0.62, 1.0))) * smoothstep(1.0, 0.82, uv.y); // calm behind the menu bar
  float al = clamp(r.a * vign * uAlpha, 0.0, 0.55);   // cap: glow, never a white-hot band behind text
  vec3 col = min(r.rgb * vign * uAlpha, vec3(al));
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
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uScroll = U('uScroll'), uAlpha = U('uAlpha'), uC1 = U('uC1'), uC2 = U('uC2'), uC3 = U('uC3');

  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const PAL = {
    dark: { c: ['#19D3FF', '#2F5BFB', '#7B3DFF'].map(hex), alpha: 0.58 },
    light: { c: ['#0091D9', '#2F5BFB', '#6627FA'].map(hex), alpha: 0.34 },
  };

  // render below CSS resolution: the strands are soft light, so this keeps it cheap
  const scale = small ? 0.6 : 0.85;
  function resize() {
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  }

  let sTarget = 0, s = 0, t0 = performance.now(), raf = 0, last = 0;
  const readScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    sTarget = Math.min(1, Math.max(0, window.scrollY / max));
  };

  function draw(now) {
    const theme = PAL[doc.dataset.theme === 'light' ? 'light' : 'dark'];
    s += (sTarget - s) * (reduced ? 1 : 0.07);
    gl.uniform2f(uRes, cv.width, cv.height);
    gl.uniform1f(uTime, reduced ? 0 : (now - t0) / 1000);
    gl.uniform1f(uScroll, s);
    gl.uniform1f(uAlpha, theme.alpha);
    gl.uniform3fv(uC1, theme.c[0]); gl.uniform3fv(uC2, theme.c[1]); gl.uniform3fv(uC3, theme.c[2]);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    // ~45 fps is plenty for slow silk and saves battery
    if (now - last > 21) { last = now; draw(now); }
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };

  resize(); readScroll(); s = sTarget; draw(performance.now());
  requestAnimationFrame(() => cv.classList.add('is-on'));
  window.addEventListener('resize', () => { resize(); readScroll(); draw(performance.now()); }, { passive: true });
  window.addEventListener('scroll', () => { readScroll(); if (reduced) draw(performance.now()); }, { passive: true });
  document.addEventListener('visibilitychange', start);
  new MutationObserver(() => draw(performance.now())).observe(doc, { attributes: true, attributeFilter: ['data-theme'] });
  start();
})();
