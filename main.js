import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Gardens bundled with the page. Add your own with scripts/extract.mjs.
const REPOS = [
  { id: "setu", owner: "naman-verma-02/setu" },
  { id: "capproof", owner: "naman-verma-02/capproof" },
  { id: "snapfind", owner: "naman-verma-02/snapfind" },
  { id: "subwatch", owner: "naman-verma-02/subwatch" },
  { id: "web-development", owner: "naman-verma-02/web-development" },
];

const R = 14; // island radius
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = () => Math.min(innerWidth, innerHeight) < 620;

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const n = (noise2(x * 0.17 + 3, z * 0.17 + 7) - 0.5) * 0.5 + (noise2(x * 0.6, z * 0.6) - 0.5) * 0.12;
  const t = smoothstep(R - 1.4, R + 2.4, r);
  return (0.6 + n) * (1 - t) - 1.3 * t;
}
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const fmtDate = (t) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const prettyName = (n) => (n === n.toUpperCase() ? n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------------------------------------------------------------- what grows from what
const CODE = new Set("js mjs cjs jsx ts tsx py go rs java kt swift c h cpp hpp cc cs rb php dart sh bash zsh ps1 sql lua r scala ex exs zig ipynb".split(" "));
const ASSET = new Set("png jpg jpeg gif svg webp ico avif bmp mp3 wav ogg mp4 webm mov glb gltf obj fbx ttf otf woff woff2 pdf zip onnx bin pt".split(" "));
const DOC = new Set("md mdx txt rst adoc".split(" "));
const STYLE = new Set("css scss sass less styl".split(" "));
const MARKUP = new Set("html htm vue svelte astro ejs hbs njk jinja j2".split(" "));
const DATA = new Set("json jsonc yml yaml toml lock ini env xml csv tsv cfg conf properties plist gradle".split(" "));
const LANG = { js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "JavaScript", ts: "TypeScript", tsx: "TypeScript", py: "Python", ipynb: "Notebook", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", swift: "Swift", c: "C", h: "C header", cpp: "C++", hpp: "C++", cs: "C#", rb: "Ruby", php: "PHP", dart: "Dart", sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell", sql: "SQL", lua: "Lua" };
const LEAF = { ts: "#77a24a", tsx: "#77a24a", js: "#b9a840", mjs: "#b9a840", cjs: "#b9a840", jsx: "#b9a840", py: "#5c9469", ipynb: "#5c9469", go: "#4d8f86", rs: "#b66f3c", java: "#a95a44", kt: "#a95a44", sh: "#8d9b4c", bash: "#8d9b4c", ps1: "#8d9b4c", sql: "#6b8e9d", default: "#6c9246" };

const KINDS = {
  tree: { name: "Trees", desc: "Source code, tinted by language" },
  pine: { name: "Pines", desc: "Tests" },
  shrub: { name: "Shrubs", desc: "Markup and templates" },
  flower: { name: "Flowers", desc: "Stylesheets" },
  mushroom: { name: "Mushrooms", desc: "Docs and text" },
  stone: { name: "Stones", desc: "Config, data, lockfiles" },
  crystal: { name: "Crystals", desc: "Images, fonts, media, models" },
  grass: { name: "Grass", desc: "Everything else" },
};
const KIND_ICON = {
  tree: '<rect x="10" y="12" width="2.4" height="8" fill="#6a4a34"/><circle cx="11.2" cy="9" r="6" fill="#77a24a"/>',
  pine: '<rect x="10" y="16" width="2.2" height="5" fill="#6a4a34"/><path d="M11.1 2 4.5 17h13.2z" fill="#3e6a4c"/>',
  shrub: '<ellipse cx="9" cy="15" rx="6.5" ry="4.6" fill="#5a8a48"/><ellipse cx="15" cy="16" rx="4.5" ry="3.5" fill="#6b9a54"/>',
  flower: '<rect x="10.3" y="11" width="1.4" height="10" fill="#5d7d3a"/><circle cx="11" cy="8" r="5" fill="#e48b8f"/><circle cx="11" cy="8" r="1.9" fill="#f4dd8a"/>',
  mushroom: '<rect x="8.6" y="11" width="4.8" height="9" rx="1.5" fill="#e9dcc4"/><path d="M3 12.5a8 7 0 0 1 16 0z" fill="#a9563b"/>',
  stone: '<path d="M4 18.5 6.5 11l6-3 6 4.5 1 6z" fill="#8b8880"/>',
  crystal: '<path d="M11 2 15 11 11 20 7 11z" fill="#9ed6cf"/><path d="M16.5 10 18.8 15 16.5 20 14.4 15z" fill="#7fc0b8"/>',
  grass: '<path d="M6 20 7.5 9 9 20M10 20 11.5 6 13 20M14 20 15.5 10 17 20" fill="#8aa35a"/>',
};

function kindOf(path) {
  const l = path.toLowerCase(), name = l.split("/").pop();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (/(^|\/)(tests?|__tests__|spec|specs|e2e)(\/|$)|[._-](test|spec)\.[a-z]+$|^test_.*\.py$/.test(l)) return "pine";
  if (ASSET.has(ext)) return "crystal";
  if (DOC.has(ext) || /^(license|licence|readme|changelog|contributing|authors|notice)/.test(name)) return "mushroom";
  if (STYLE.has(ext)) return "flower";
  if (MARKUP.has(ext)) return "shrub";
  if (DATA.has(ext) || name.startsWith(".") || /lock|^dockerfile|^makefile|^procfile/.test(name)) return "stone";
  if (CODE.has(ext)) return "tree";
  return "grass";
}
const extOf = (p) => { const n = p.split("/").pop().toLowerCase(); return n.includes(".") ? n.split(".").pop() : ""; };

function sizeFor(kind, lines) {
  const L = Math.log10(1 + Math.max(1, lines));
  switch (kind) {
    case "tree": case "pine": return clamp(0.55 + 0.38 * L, 0.55, 1.75);
    case "shrub": return clamp(0.55 + 0.3 * L, 0.55, 1.4);
    case "flower": return clamp(0.55 + 0.22 * L, 0.55, 1.15);
    case "mushroom": return clamp(0.5 + 0.25 * L, 0.5, 1.15);
    case "stone": return clamp(0.45 + 0.18 * L, 0.45, 1.05);
    case "crystal": return clamp(0.55 + 0.2 * L, 0.55, 1.1);
    default: return clamp(0.45 + 0.2 * L, 0.45, 0.9);
  }
}
const footprint = (kind, S) => (kind === "tree" ? 0.42 : kind === "pine" ? 0.36 : kind === "shrub" ? 0.45 : 0.3) * S;

// ---------------------------------------------------------------- renderer, scene, camera
const canvas = $("scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  document.body.insertAdjacentHTML("beforeend", '<p class="notice">This garden needs WebGL, which this browser has turned off.</p>');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const skyCanvas = document.createElement("canvas"); skyCanvas.width = 4; skyCanvas.height = 512;
const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
scene.fog = new THREE.Fog("#c0957e", 58, 125);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 400);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.4, 0);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 12; controls.maxDistance = 70;
controls.minPolarAngle = 0.3; controls.maxPolarAngle = 1.27;
controls.autoRotateSpeed = 0.35;
let lastInteract = -99;
controls.addEventListener("start", () => { lastInteract = clock.elapsedTime; });

const hemi = new THREE.HemisphereLight("#a8bfcd", "#40502b", 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffc28c", 3.0);
sun.position.set(-18, 13, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(small() ? 1024 : 2048, small() ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 110 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const rim = new THREE.DirectionalLight("#86abcb", 0.7); rim.position.set(16, 8, -14); scene.add(rim);

// water and shoreline foam
const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 200, 200), new THREE.MeshStandardMaterial({ color: "#1f454e", roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.9, flatShading: true }));
water.rotation.x = -Math.PI / 2; water.receiveShadow = true; scene.add(water);
// low-poly rolling waves, calmer near the shore; waveAt() in JS mirrors this so boats ride them
water.material.onBeforeCompile = (sh) => {
  sh.uniforms.uTime = waterTime; sh.uniforms.uAmp = waveAmp;
  sh.vertexShader = "uniform float uTime; uniform float uAmp;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    float amp = smoothstep(${R.toFixed(1)}, ${(R + 6).toFixed(1)}, length(position.xy));
    transformed.z += (0.13 * sin(position.x * 0.35 + uTime * 0.9) + 0.085 * sin(position.y * 0.42 - uTime * 0.7) + 0.045 * sin((position.x + position.y) * 0.8 + uTime * 1.6)) * (0.3 + 0.7 * amp) * uAmp;`);
};
const foamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { time: { value: 0 } },
  vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform float time; varying vec2 vP;
    void main(){ float r = length(vP); float d = r - ${(R + 0.15).toFixed(2)};
      float wob = sin(atan(vP.y, vP.x) * 9.0 + time * 0.6) * 0.12;
      float lap = smoothstep(0.45, 0.0, abs(d + wob - 0.1)) * 0.55;
      float rings = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin((d + wob) * 6.0 - time * 1.3)) * smoothstep(2.6, 0.2, d) * step(0.0, d) * 0.22;
      gl_FragColor = vec4(0.94, 0.9, 0.82, lap + rings); }`,
});
const foam = new THREE.Mesh(new THREE.RingGeometry(R - 1.2, R + 3.2, 200, 6), foamMat);
foam.rotation.x = -Math.PI / 2; foam.position.y = 0.02; scene.add(foam);

// lantern at the centre: flares on every commit
const lantern = new THREE.Group();
{
  const stone = new THREE.MeshStandardMaterial({ color: "#8a877d", roughness: 0.95, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.3, 6), stone); base.position.y = 0.15;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 6), stone); post.position.y = 0.55;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 6), stone); roof.position.y = 1.2;
  lantern.core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: "#ffe1a0", emissive: "#ffb648", emissiveIntensity: 2.2 }));
  lantern.core.position.y = 0.95;
  lantern.light = new THREE.PointLight("#ffc46a", 5, 7, 1.6); lantern.light.position.y = 1.0;
  for (const m of [base, post, roof]) { m.castShadow = true; m.receiveShadow = true; }
  lantern.add(base, post, roof, lantern.core, lantern.light);
  lantern.position.y = heightAt(0, 0) - 0.05;
  lantern.flare = 0;
  scene.add(lantern);
}

// ---------------------------------------------------------------- sky that follows the hour of each commit
const stars = (() => {
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3, r = 160;
    pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#e4ebff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(pts); return pts;
})();
// hour, sky top, sky middle, horizon, fog, sun colour, sun strength, ambient, exposure, night, water
const SKY = [
  [0, "#05080f", "#0b1626", "#1f2c40", "#1a2433", "#9db1dc", 0.45, 0.4, 0.95, 1, "#0d1f28"],
  [4.6, "#070b16", "#121d33", "#2c3550", "#262f45", "#9db1dc", 0.45, 0.42, 0.95, 1, "#0f2029"],
  [6.6, "#2a3854", "#6f708a", "#e8a585", "#c69a8c", "#ffb98a", 1.9, 0.85, 1.0, 0.3, "#244651"],
  [9.5, "#4a82b2", "#8db8d6", "#dbe7e6", "#b9ccd0", "#fff1d8", 3.2, 1.25, 1.0, 0, "#2b6370"],
  [15, "#3f7db0", "#86b5d6", "#e3ece6", "#bccfd2", "#fff3e0", 3.3, 1.25, 1.0, 0, "#2b6370"],
  [17.5, "#132630", "#2d4a57", "#d39f7d", "#c0957e", "#ffc28c", 3.0, 1.1, 1.05, 0.05, "#1f454e"],
  [19.6, "#0e1526", "#3b3550", "#c77c6a", "#7f6170", "#ff9a6a", 1.4, 0.65, 1.0, 0.6, "#182f3a"],
  [21.6, "#05080f", "#0b1626", "#1f2c40", "#1a2433", "#9db1dc", 0.45, 0.4, 0.95, 1, "#0d1f28"],
  [24, "#05080f", "#0b1626", "#1f2c40", "#1a2433", "#9db1dc", 0.45, 0.4, 0.95, 1, "#0d1f28"],
];
const GOLDEN = 17.5;
let night = 0, hourNow = GOLDEN, hourWant = GOLDEN, skyDirty = true;
const _sa = new THREE.Color(), _sb = new THREE.Color(), MOON = new THREE.Vector3(12, 20, -10), _sun = new THREE.Vector3();
const localHour = (c) => ((((c.t + (c.o || 0) * 60) / 3600) % 24) + 24) % 24;
function applySky(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  const L = (k) => a[k] + (b[k] - a[k]) * t;
  const C = (k, out) => out.set(a[k]).lerp(_sb.set(b[k]), t);
  const g = skyCanvas.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#" + C(1, _sa).getHexString());
  gr.addColorStop(0.42, "#" + C(2, _sa).getHexString());
  gr.addColorStop(0.76, "#" + C(3, _sa).getHexString());
  gr.addColorStop(1, "#" + C(3, _sa).lerp(_sb.set("#fff4e0"), 0.18).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const over = Math.min(0.75, wx.cur.cover * 0.45 + wx.cur.rain * 0.2 + wx.cur.storm * 0.25), haze = wx.cur.mist * 0.45 * (1 - night);
  if (over > 0.01 || haze > 0.01) { g.globalAlpha = over; g.fillStyle = night > 0.5 ? "#141a20" : "#7c858b"; g.fillRect(0, 0, 4, 512); g.globalAlpha = haze; g.fillStyle = "#d6d6cf"; g.fillRect(0, 0, 4, 512); g.globalAlpha = 1; }
  skyTex.needsUpdate = true;
  C(4, scene.fog.color); C(5, sun.color); C(10, water.material.color);
  skyBase.sun = L(6); skyBase.hemi = L(7); skyBase.exposure = L(8); night = L(9); skyBase.fog.copy(scene.fog.color);
  const arc = clamp((h - 5) / 15, 0, 1) * Math.PI;
  sun.position.copy(_sun.set(-Math.cos(arc) * 20, 4 + Math.sin(arc) * 18, 12).lerp(MOON, night)).setLength(48);
  stars.material.opacity = night * 0.9;
}
function updateSky(dt) {
  const d = ((hourWant - hourNow + 36) % 24) - 12;
  if (Math.abs(d) < 0.01 && !skyDirty) return;
  hourNow = reduceMotion || Math.abs(d) < 0.01 ? hourWant : (hourNow + d * Math.min(1, dt * 2.2) + 24) % 24;
  applySky(hourNow); skyDirty = false;
}
const partOfDay = (h) => (h < 5 ? "night" : h < 8 ? "dawn" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 20 ? "evening" : "night");
const clockOf = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;

const waveAmp = { value: 1 };
const WX_KEYS = ["cover", "rain", "snow", "mist", "wind", "storm"];
const wx = { cur: { cover: 0.12, rain: 0, snow: 0, mist: 0, wind: 0.15, storm: 0 }, want: null, label: "clear", mode: "auto", flash: 0, nextBolt: 4, churnTop: 400 };
wx.want = { ...wx.cur };
const skyBase = { sun: 3, hemi: 1.1, exposure: 1.05, fog: new THREE.Color("#c0957e") };
// ---------------------------------------------------------------- post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.85);
composer.addPass(bloom);
const TiltShift = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, dir: { value: new THREE.Vector2(1, 0) }, amount: { value: 2.6 }, focus: { value: 0.47 }, range: { value: 0.42 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 resolution; uniform vec2 dir; uniform float amount; uniform float focus; uniform float range; varying vec2 vUv;
    void main(){ float b = smoothstep(range * 0.35, range, abs(vUv.y - focus)) * amount;
      vec4 sum = vec4(0.0); float tot = 0.0;
      for (int i = -6; i <= 6; i++) { float w = exp(-float(i * i) / 18.0); sum += texture2D(tDiffuse, vUv + dir * float(i) * b / resolution) * w; tot += w; }
      gl_FragColor = sum / tot; }`,
};
const tiltH = new ShaderPass(TiltShift); tiltH.uniforms.dir.value.set(1, 0);
const tiltV = new ShaderPass(TiltShift); tiltV.uniforms.dir.value.set(0, 1);
composer.addPass(tiltH); composer.addPass(tiltV);
composer.addPass(new OutputPass());
const grain = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float n = fract(sin(dot(vUv * 913.0 + fract(time) * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.04;
      c.rgb *= mix(0.74, 1.0, smoothstep(0.92, 0.32, length((vUv - 0.5) * vec2(1.1, 1.0))));
      gl_FragColor = c; }`,
});
composer.addPass(grain);

function resize() {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  composer.setSize(w, h); composer.setPixelRatio(pr);
  camera.aspect = w / h; camera.fov = w / h < 0.8 ? 38 : 30; camera.updateProjectionMatrix();
  for (const p of [tiltH, tiltV]) p.uniforms.resolution.value.set(w * pr, h * pr);
}
addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------- shared plant geometry
function lumpy(geo, amt, seed) {
  const pos = geo.attributes.position, seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, 1 + (hash(pos.getX(i) * 9 + seed, pos.getZ(i) * 7 + pos.getY(i) * 5) - 0.5) * amt);
    const s = seen.get(k); pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  geo.computeVertexNormals(); return geo;
}
const GEO = {
  trunk: new THREE.CylinderGeometry(0.08, 0.11, 1, 6).translate(0, 0.5, 0),
  canopy: lumpy(new THREE.IcosahedronGeometry(0.5, 1), 0.28, 1),
  cone: new THREE.ConeGeometry(0.42, 1, 7).translate(0, 0.5, 0),
  petal: new THREE.IcosahedronGeometry(0.5, 0),
  dot: new THREE.SphereGeometry(0.5, 8, 6),
  cap: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  stone: lumpy(new THREE.DodecahedronGeometry(0.5, 0), 0.25, 4),
  crystal: new THREE.OctahedronGeometry(0.5, 0),
  grass: new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0),
};
const MAT = {
  plant: new THREE.MeshStandardMaterial({ roughness: 0.86, flatShading: true }),
  crystal: new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.1, flatShading: true, emissive: "#2e8a84", emissiveIntensity: 0.85 }),
};
const _e = new THREE.Euler(), _qq = new THREE.Quaternion();
const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _qq.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const col = (hex) => new THREE.Color(hex);

function partsFor(kind, ext, r) {
  const j = () => (r() - 0.5);
  switch (kind) {
    case "tree": {
      const leaf = col(LEAF[ext] || LEAF.default).offsetHSL(j() * 0.03, 0, j() * 0.09);
      const top = leaf.clone().offsetHSL(0, 0, 0.05);
      return [["trunk", M4(0, 0, 0, 1, 0.95, 1), col("#6a4a34")],
        ["canopy", M4(0, 1.02, 0, 0.98, 0.82, 0.98, 0, r() * 6, 0), leaf],
        ["canopy", M4(j() * 0.3, 1.36, j() * 0.3, 0.6, 0.52, 0.6, 0, r() * 6, 0), top]];
    }
    case "pine": {
      const g = col("#3d6a4c").offsetHSL(0, 0, j() * 0.07);
      return [["trunk", M4(0, 0, 0, 0.8, 0.4, 0.8), col("#5e4331")],
        ["cone", M4(0, 0.28, 0, 1, 0.95, 1, 0, r() * 6, 0), g],
        ["cone", M4(0, 0.8, 0, 0.7, 0.85, 0.7, 0, r() * 6, 0), g.clone().offsetHSL(0, 0, 0.04)]];
    }
    case "shrub": {
      const g = col("#578a47").offsetHSL(j() * 0.03, 0, j() * 0.08);
      return [["canopy", M4(0, 0.24, 0, 1.0, 0.62, 1.0, 0, r() * 6, 0), g],
        ["canopy", M4(0.3, 0.2, 0.12, 0.62, 0.46, 0.62), g.clone().offsetHSL(0, 0, 0.05)],
        ["dot", M4(0.18, 0.5, 0.3, 0.09, 0.09, 0.09), col("#c4473e")],
        ["dot", M4(-0.25, 0.42, 0.22, 0.08, 0.08, 0.08), col("#c4473e")]];
    }
    case "flower": {
      const petals = ["#e48b8f", "#eab46a", "#d7a0d6", "#f0eadf"];
      return [["trunk", M4(0, 0, 0, 0.35, 0.62, 0.35), col("#5d7d3a")],
        ["petal", M4(0, 0.64, 0, 0.58, 0.22, 0.58, 0, r() * 6, 0), col(petals[Math.floor(r() * petals.length)])],
        ["dot", M4(0, 0.7, 0, 0.17, 0.12, 0.17), col("#f4dd8a")],
        ["canopy", M4(0.12, 0.08, 0.05, 0.28, 0.12, 0.16, 0, r() * 6, 0), col("#6a8f43")]];
    }
    case "mushroom": {
      const cap = col(r() < 0.75 ? "#a9563b" : "#c99a52");
      return [["trunk", M4(0, 0, 0, 2.2, 0.4, 2.2), col("#e9dcc4")],
        ["cap", M4(0, 0.36, 0, 0.78, 0.58, 0.78), cap],
        ["dot", M4(0.18, 0.62, 0.12, 0.07, 0.04, 0.07), col("#f2e8d5")],
        ["dot", M4(-0.14, 0.6, 0.2, 0.06, 0.035, 0.06), col("#f2e8d5")]];
    }
    case "stone": {
      const g = col("#8b8880").offsetHSL(0, j() * 0.04, j() * 0.1);
      return [["stone", M4(0, 0.1, 0, 0.85, 0.55, 0.72, 0, r() * 6, 0), g],
        ["stone", M4(0.32, 0.05, 0.16, 0.36, 0.26, 0.32, 0, r() * 6, 0), g.clone().offsetHSL(0, 0, 0.05)]];
    }
    case "crystal":
      return [["crystal", M4(0, 0.42, 0, 0.34, 0.92, 0.34, 0, r(), 0), col("#a4dad2")],
        ["crystal", M4(0.2, 0.22, 0.06, 0.2, 0.52, 0.2, 0, 0, -0.45), col("#84c4bb")],
        ["stone", M4(0, 0.03, 0, 0.5, 0.16, 0.45), col("#7d7a72")]];
    default:
      return [["grass", M4(0, 0, 0, 0.22, 0.55, 0.22, 0.1, 0, 0.12), col("#8aa35a")],
        ["grass", M4(0.14, 0, 0.06, 0.18, 0.42, 0.18, -0.1, 0, -0.2), col("#7d9a52")],
        ["grass", M4(-0.1, 0, 0.12, 0.18, 0.38, 0.18, 0.15, 0, 0.1), col("#93ac62")]];
  }
}

// ---------------------------------------------------------------- per-garden state
let data = null, plants = [], meshes = {}, creatures = [], sectors = [], signs = [], terrain = null;
let idx = -1, playing = false, stepTimer = 0, stepInterval = 0.8, started = false;
let state = null;
const clock = new THREE.Clock();
const signGroup = new THREE.Group(); scene.add(signGroup);
const labelsEl = $("labels");

function layout() {
  const groups = new Map();
  data.files.forEach((p, i) => { const k = p.includes("/") ? p.split("/")[0] : ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const list = [...groups].map(([name, files]) => ({ name, files: files.sort((a, b) => (data.files[a] < data.files[b] ? -1 : 1)) }));
  list.sort((a, b) => (a.name === "" ? 1 : b.name === "" ? -1 : a.name.localeCompare(b.name)));
  const weights = list.map((g) => Math.sqrt(g.files.length) + 0.9), total = weights.reduce((a, b) => a + b, 0);

  // largest footprint each file ever reaches
  const maxLines = new Float64Array(data.files.length), cur = new Float64Array(data.files.length);
  for (const c of data.commits) for (const [f, a, d, k] of c.c) {
    if (k[0] === "d") { cur[f] = 0; continue; }
    cur[f] = k.length > 1 ? 40 : Math.max(1, cur[f] + a - d); maxLines[f] = Math.max(maxLines[f], cur[f]);
  }

  const r = rng(strSeed(data.name));
  sectors = []; plants = [];
  let a0 = 0;
  list.forEach((g, gi) => {
    const width = (weights[gi] / total) * Math.PI * 2;
    const s = { name: g.name, start: a0, end: a0 + width, count: g.files.length, i: gi };
    sectors.push(s); a0 += width;
    g.files.forEach((f, j) => {
      const N = g.files.length, u = (j + 0.5) / N;
      const rad = N === 1 ? R * 0.55 : 2.3 + (R - 3.4) * Math.sqrt((j * 0.618034 + 0.31 + r() * 0.08) % 1);
      const th = s.start + width * u;
      const kind = kindOf(data.files[f]), ext = extOf(data.files[f]);
      const Smax = sizeFor(kind, maxLines[f] || 30);
      plants.push({ i: f, kind, ext, sector: s, x: Math.cos(th) * rad, z: Math.sin(th) * rad, fp: footprint(kind, Smax),
        yaw: r() * Math.PI * 2, tiltAxis: new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize(), phase: r() * 6.28,
        parts: partsFor(kind, ext, r).map(([geo, local, color]) => ({ geo, local, color })),
        alive: false, g: 0, v: 0, w: 0, S: 0.6, St: 0.6, pulse: 0, delay: 0, hover: false, shake: 0, sick: 0, nibbling: false });
    });
  });

  // relax so plants don't overlap, keeping each inside its own patch and off the paths
  const byIndex = []; plants.forEach((p) => (byIndex[p.i] = p));
  for (let it = 0; it < 45; it++) {
    for (let a = 0; a < plants.length; a++) for (let b = a + 1; b < plants.length; b++) {
      const p = plants[a], q = plants[b];
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 0.001, m = p.fp + q.fp + 0.06;
      if (d < m) { const push = (m - d) / 2, ux = dx / d, uz = dz / d; p.x -= ux * push; p.z -= uz * push; q.x += ux * push; q.z += uz * push; }
    }
    for (const p of plants) {
      let rad = Math.hypot(p.x, p.z), th = Math.atan2(p.z, p.x); if (th < 0) th += Math.PI * 2;
      rad = clamp(rad, 1.9 + p.fp, R - 0.7 - p.fp);
      const s = p.sector;
      if (th < s.start - 0.5 && s.end > Math.PI * 1.5) th += Math.PI * 2;
      const pad = (0.3 + p.fp) / rad, lo = s.start + pad, hi = s.end - pad;
      th = lo < hi ? clamp(th, lo, hi) : (s.start + s.end) / 2;
      p.x = Math.cos(th) * rad; p.z = Math.sin(th) * rad;
    }
  }
  for (const p of plants) p.y = heightAt(p.x, p.z) - 0.04;
  plants.byFile = byIndex;
}

const GRASS = ["#6b8a3e", "#5d7f3d", "#788f43", "#57743a", "#6e8649", "#628039", "#71883d"];
function buildTerrain() {
  if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
  const g = new THREE.RingGeometry(0.001, R + 3.2, 420, 70);
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), sand = col("#d4b98c"), wet = col("#9c8566"), deep = col("#4f6159"), path = col("#a1865f");
  const grass = sectors.map((s, i) => col(GRASS[i % GRASS.length]));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = -pos.getY(i), rad = Math.hypot(x, z);
    let th = Math.atan2(z, x); if (th < 0) th += Math.PI * 2;
    let h = heightAt(x, z);
    const s = sectors.find((q) => th >= q.start && th < q.end) || sectors[sectors.length - 1];
    const edge = Math.min(th - s.start, s.end - th) * rad;
    // soft-edged footpaths between folders, fading out before the shore
    const wob = (noise2(x * 1.3, z * 1.3) - 0.5) * 0.12;
    const along = smoothstep(1.0, 1.6, rad) * smoothstep(R - 0.4, R - 2.2, rad);
    const onPath = sectors.length > 1 ? smoothstep(0.2, 0.07, edge + wob) * along : 0;
    const plaza = smoothstep(1.7, 1.35, rad + wob);
    const dirt = Math.max(onPath, plaza);
    c.copy(grass[s.i]).offsetHSL(0, 0, (noise2(x * 0.9, z * 0.9) - 0.5) * 0.07);
    if (dirt > 0) { c.lerp(path.clone().offsetHSL(0, 0, (noise2(x * 2, z * 2) - 0.5) * 0.05), dirt); h -= 0.05 * dirt; }
    const grassy = smoothstep(0.16, 0.42, h);
    if (grassy < 1) { const sc = sand.clone().lerp(wet, smoothstep(0.2, 0.02, h)); c.lerp(sc, 1 - grassy); }
    if (h < -0.05) c.lerp(deep, smoothstep(-0.05, -0.9, h));
    pos.setXYZ(i, x, h, z);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);
}

function buildSigns() {
  signGroup.clear(); labelsEl.innerHTML = ""; signs = [];
  const wood = new THREE.MeshStandardMaterial({ color: "#7a5a3e", roughness: 0.9, flatShading: true });
  const ranked = [...sectors].sort((a, b) => b.count - a.count);
  const keep = new Set(ranked.slice(0, small() ? 5 : 9));
  for (const s of sectors) {
    if (!keep.has(s)) continue;
    const mid = (s.start + s.end) / 2, rad = R - 0.55, x = Math.cos(mid) * rad, z = Math.sin(mid) * rad, y = heightAt(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.75, 5), wood); post.position.set(x, y + 0.37, z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.04), wood); board.position.set(x, y + 0.68, z); board.lookAt(0, y + 0.68, 0);
    post.castShadow = board.castShadow = true;
    signGroup.add(post, board);
    const el = document.createElement("div"); el.className = "sign";
    el.innerHTML = `${esc(s.name ? s.name + "/" : "root")}<small>${s.count}</small>`;
    labelsEl.appendChild(el);
    signs.push({ el, pos: new THREE.Vector3(x, y + 0.95, z) });
  }
}

function buildPlantMeshes() {
  for (const m of Object.values(meshes)) { scene.remove(m); m.dispose(); }
  meshes = {};
  const counts = {};
  for (const p of plants) for (const part of p.parts) counts[part.geo] = (counts[part.geo] || 0) + 1;
  for (const [g, n] of Object.entries(counts)) {
    const mesh = new THREE.InstancedMesh(GEO[g], g === "crystal" ? MAT.crystal : MAT.plant, n);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.owner = new Int32Array(n); mesh.userData.next = 0;
    meshes[g] = mesh; scene.add(mesh);
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const p of plants) for (const part of p.parts) {
    const mesh = meshes[part.geo]; part.mesh = mesh; part.slot = mesh.userData.next++;
    mesh.userData.owner[part.slot] = p.i; mesh.setMatrixAt(part.slot, zero); mesh.setColorAt(part.slot, part.color);
  }
}

// ---------------------------------------------------------------- creatures (one per committer)
const CREATURE_COLORS = ["#a3c76c", "#e6ad5c", "#83bccc", "#dc8ea6", "#c6b9ec", "#e9d37b", "#90d3aa", "#f0a47e"];
const eyeMat = new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.3 });
const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
const cheekMat = new THREE.MeshStandardMaterial({ color: "#f09a8b", roughness: 0.9, transparent: true, opacity: 0.8 });
const leafMat = new THREE.MeshStandardMaterial({ color: "#8cc05a", roughness: 0.8, flatShading: true });

class Creature {
  constructor(author, i, n) {
    this.author = author; this.i = i;
    this.color = author.bot ? "#a7a69d" : CREATURE_COLORS[i % CREATURE_COLORS.length];
    const g = new THREE.Group(); this.group = g;
    const body = new THREE.Group(); this.body = body; g.add(body);
    const skin = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.95, flatShading: author.bot });
    const blob = new THREE.Mesh(author.bot ? new THREE.DodecahedronGeometry(0.3, 0) : new THREE.SphereGeometry(0.3, 20, 16), skin);
    blob.scale.set(1, 0.88, 1); blob.position.y = 0.27; blob.castShadow = true; body.add(blob); this.hit = blob; blob.userData.creature = this;
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat); eye.position.set(0.1 * sx, 0.33, 0.25); body.add(eye); this.eyes.push(eye);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), glintMat); gl.position.set(0.1 * sx + 0.014, 0.346, 0.288); body.add(gl); this.eyes.push(gl);
      if (!author.bot) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), cheekMat); ch.scale.set(1, 0.55, 0.4); ch.position.set(0.17 * sx, 0.255, 0.225); body.add(ch); }
    }
    if (author.bot) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), eyeMat); ant.position.y = 0.62; body.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: "#ffe09a", emissive: "#ffb43c", emissiveIntensity: 2.5 }));
      tip.position.y = 0.75; body.add(tip);
    } else {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.13, 5), leafMat); stem.position.set(0, 0.58, 0); body.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leafMat); leaf.scale.set(1, 0.28, 0.5); leaf.position.set(0.055, 0.655, 0); leaf.rotation.z = 0.5; body.add(leaf);
    }
    const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.4;
    this.pos = new THREE.Vector3(Math.cos(a) * 2.1, 0, Math.sin(a) * 2.1);
    this.home = this.pos.clone(); this.target = null; this.queue = []; this.hop = 0; this.tend = 0; this.idle = Math.random() * 3; this.heading = a + Math.PI; this.blink = 2 + Math.random() * 3;
    this.tagEl = document.createElement("div"); this.tagEl.className = "nametag"; this.tagEl.style.setProperty("--c", this.color);
    this.tagEl.textContent = author.bot ? "github-actions bot" : prettyName(author.name); this.tagEl.style.opacity = 0;
    labelsEl.appendChild(this.tagEl);
    scene.add(g);
  }
  visit(points) { this.queue = points; this.target = null; this.tend = 0; }
  pet() {
    this.pets = (this.pets || 0) + 1; this.petT = 1.25; sfx.boing();
    _p.copy(this.group.position); _p.y += 0.7; _p.project(camera);
    const x = ((_p.x + 1) / 2) * innerWidth, y = ((1 - _p.y) / 2) * innerHeight;
    for (let k = 0; k < 3 + Math.min(4, this.pets); k++) {
      const h = document.createElement("div"); h.className = "heart";
      h.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 14.2 2.2 8.6A3.4 3.4 0 0 1 8 3.9a3.4 3.4 0 0 1 5.8 4.7z"/></svg>';
      h.style.setProperty("--x", `${x + (Math.random() - 0.5) * 30}px`); h.style.setProperty("--y", `${y}px`);
      h.style.setProperty("--dx", `${(Math.random() - 0.5) * 50}px`); h.style.animationDelay = `${k * 90}ms`;
      h.addEventListener("animationend", () => h.remove());
      labelsEl.appendChild(h);
    }
  }
  update(dt, t) {
    if (this.scripted && !(this.petT > 0)) {
      this.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z) - 0.03, this.pos.z);
      this.group.rotation.y = this.heading; this.body.rotation.y = 0;
      return;
    }
    if (this.petT > 0) {
      this.petT = Math.max(0, this.petT - dt);
      const k = 1 - this.petT / 1.25;
      this.body.position.y = Math.sin(k * Math.PI) * 0.55;
      this.body.rotation.y = reduceMotion ? 0 : k * Math.PI * 2;
      const sq = 1 + Math.sin(k * Math.PI * 3) * 0.12 * (1 - k);
      this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      this.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z) - 0.03, this.pos.z);
      return;
    }
    this.body.rotation.y = 0;
    if (this.tend > 0) {
      this.tend -= dt;
      const k = Math.sin((1 - this.tend / 0.6) * Math.PI * 2);
      this.body.scale.set(1 + 0.08 * k, 1 - 0.1 * k, 1 + 0.08 * k);
    } else {
      if (!this.target && this.queue.length) this.target = this.queue.shift();
      if (!this.target) {
        this.idle -= dt;
        if (this.idle < 0) {
          const a = Math.random() * Math.PI * 2, d = 0.6 + Math.random() * 1.4;
          const tx = this.home.x + Math.cos(a) * d, tz = this.home.z + Math.sin(a) * d, rr = Math.hypot(tx, tz), lim = R - 1.2;
          this.target = { x: rr > lim ? (tx / rr) * lim : tx, z: rr > lim ? (tz / rr) * lim : tz, idle: true };
          this.idle = 2.5 + Math.random() * 4;
        }
      }
      if (this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
        const speed = this.target.idle ? 0.65 : 1.9 + this.queue.length * 0.4;
        if (d < 0.05) {
          if (!this.target.idle) { this.tend = 0.6; if (this.target.plant) this.target.plant.pulse = 1; this.home.set(this.pos.x, 0, this.pos.z); }
          this.target = null; this.hop = 0;
        } else {
          const step = Math.min(d, speed * dt);
          this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; this.hop += step * 7.5;
          let want = Math.atan2(dx, dz), diff = ((want - this.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          this.heading += diff * Math.min(1, dt * 10);
        }
      }
      const hopY = Math.abs(Math.sin(this.hop));
      this.body.position.y = hopY * (this.target ? 0.22 : 0);
      const sq = this.target ? 1 - 0.1 * Math.cos(this.hop * 2) : 1 + Math.sin(t * 2.2 + this.i) * 0.025;
      this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    this.blink -= dt;
    const shut = this.blink < 0 && this.blink > -0.12;
    for (const e of this.eyes) e.scale.y = shut ? 0.15 : 1;
    if (this.blink < -0.12) this.blink = 2 + Math.random() * 4;
    this.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z) - 0.03, this.pos.z);
    this.group.rotation.y = this.heading;
  }
  dispose() { scene.remove(this.group); this.tagEl.remove(); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
}

// ---------------------------------------------------------------- fireflies
const FF = 900, AMBIENT = 46;
const ffGeo = new THREE.BufferGeometry();
const ffPos = new Float32Array(FF * 3), ffAlpha = new Float32Array(FF), ffSize = new Float32Array(FF);
const ffVel = new Float32Array(FF * 3), ffLife = new Float32Array(FF), ffMax = new Float32Array(FF);
ffGeo.setAttribute("position", new THREE.BufferAttribute(ffPos, 3).setUsage(THREE.DynamicDrawUsage));
ffGeo.setAttribute("aAlpha", new THREE.BufferAttribute(ffAlpha, 1).setUsage(THREE.DynamicDrawUsage));
ffGeo.setAttribute("aSize", new THREE.BufferAttribute(ffSize, 1));
const fireflies = new THREE.Points(ffGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { pr: { value: renderer.getPixelRatio() } },
  vertexShader: "attribute float aAlpha; attribute float aSize; uniform float pr; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * pr * (38.0 / -mv.z); vA = aAlpha; }",
  fragmentShader: "varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a; gl_FragColor = vec4(vec3(1.0, 0.8, 0.4) * 2.4, a * vA); }",
}));
fireflies.frustumCulled = false; scene.add(fireflies);
for (let i = 0; i < AMBIENT; i++) {
  const a = Math.random() * Math.PI * 2, rr = 2 + Math.random() * (R - 3);
  ffPos.set([Math.cos(a) * rr, 0.8 + Math.random() * 2, Math.sin(a) * rr], i * 3);
  ffSize[i] = 0.6 + Math.random() * 0.6; ffMax[i] = Math.random() * 6.28;
}
let ffNext = AMBIENT;
function burst(x, y, z, n) {
  for (let k = 0; k < n; k++) {
    const i = ffNext; ffNext = ffNext + 1 >= FF ? AMBIENT : ffNext + 1;
    ffPos.set([x + (Math.random() - 0.5) * 0.5, y + 0.3 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.5], i * 3);
    ffVel.set([(Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5], i * 3);
    ffLife[i] = ffMax[i] = 1.4 + Math.random() * 1.4; ffSize[i] = 0.7 + Math.random() * 0.8;
  }
  ffGeo.attributes.aSize.needsUpdate = true;
}
function updateFireflies(dt, t) {
  for (let i = 0; i < AMBIENT; i++) {
    const o = i * 3, ph = ffMax[i];
    ffPos[o] += Math.sin(t * 0.3 + ph) * dt * 0.25; ffPos[o + 2] += Math.cos(t * 0.27 + ph * 1.3) * dt * 0.25; ffPos[o + 1] += Math.sin(t * 0.8 + ph) * dt * 0.12;
    ffAlpha[i] = (0.25 + 0.55 * Math.max(0, Math.sin(t * 1.7 + ph * 3))) * (1 + night * 1.3);
  }
  for (let i = AMBIENT; i < FF; i++) {
    if (ffLife[i] <= 0) { ffAlpha[i] = 0; continue; }
    ffLife[i] -= dt; const o = i * 3;
    ffVel[o + 1] *= 1 - dt * 0.6;
    ffPos[o] += ffVel[o] * dt + Math.sin(t * 3 + i) * dt * 0.15; ffPos[o + 1] += ffVel[o + 1] * dt; ffPos[o + 2] += ffVel[o + 2] * dt;
    const life = ffLife[i] / ffMax[i];
    ffAlpha[i] = Math.max(0, Math.sin(life * Math.PI)) * (0.7 + 0.3 * Math.sin(t * 14 + i));
  }
  ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.aAlpha.needsUpdate = true;
}

// ---------------------------------------------------------------- history
function computeState(upTo) {
  const n = data.files.length;
  const s = { lines: new Float64Array(n), alive: new Uint8Array(n), born: new Int32Array(n).fill(-1), died: new Int32Array(n).fill(-1), touched: new Uint16Array(n), last: new Int32Array(n).fill(-1), byAuthor: data.authors.map(() => new Set()) };
  for (let k = 0; k <= upTo; k++) for (const [f, a, d, kind] of data.commits[k].c) {
    s.last[f] = k; s.byAuthor[data.commits[k].a].add(f);
    if (kind[0] === "d") { s.alive[f] = 0; s.died[f] = k; continue; }
    if (!s.alive[f]) { s.alive[f] = 1; s.born[f] = k; s.died[f] = -1; s.touched[f] = 0; s.lines[f] = 0; }
    s.touched[f]++;
    s.lines[f] = kind.length > 1 ? 40 : Math.max(1, s.lines[f] + a - d);
  }
  s.maxTouched = 1;
  for (let f = 0; f < n; f++) if (s.alive[f]) s.maxTouched = Math.max(s.maxTouched, s.touched[f]);
  s.hot = [...Array(n).keys()].filter((f) => s.alive[f] && s.touched[f] > 1).sort((x, y) => s.touched[y] - s.touched[x]).slice(0, 6);
  return s;
}

function goTo(n, stepping = false) {
  n = clamp(n, -1, data.commits.length - 1);
  cancelFight(); setBattle("");
  const prev = idx; idx = n; state = computeState(n);
  const now = clock.elapsedTime, stepped = stepping && n === prev + 1;
  for (const p of plants) {
    const was = p.alive; p.alive = !!state.alive[p.i];
    p.St = sizeFor(p.kind, state.lines[p.i] || 1);
    if (p.alive && !was) { p.S = p.St; p.delay = now + Math.random() * (stepped ? 1.0 : 0.3); }
  }
  if (stepped && n >= 0) {
    const c = data.commits[n];
    const touched = c.c.map(([f, , , k]) => ({ p: plants.byFile[f], k })).filter((o) => o.p);
    let ns = 0, nt = 0, nw = 0;
    for (const { p, k } of touched) {
      if (k[0] === "a" && ns++ < 6) sfx.sprout(Math.max(0, p.delay - now) + 0.12);
      else if (k[0] === "d" && nw++ < 2) sfx.wilt(Math.random() * 0.2);
      else if (k[0] === "m" && nt++ < 3) sfx.tend(Math.random() * 0.25);
      if (k[0] !== "a") p.pulse = 1;
      setTimeout(() => burst(p.x, p.y + p.S * 0.6, p.z, k[0] === "d" ? 2 : 4), (k[0] === "a" ? 350 : 0) + Math.random() * 300);
    }
    const cr = creatures[c.a];
    if (cr && touched.length) {
      // walk to up to six of the touched files, nearest first
      let from = { x: cr.pos.x, z: cr.pos.z }; const left = touched.filter((o) => o.k[0] !== "d").map((o) => o.p), route = [];
      while (left.length && route.length < 6) {
        let bi = 0, bd = Infinity;
        left.forEach((p, i) => { const d = Math.hypot(p.x - from.x, p.z - from.z); if (d < bd) { bd = d; bi = i; } });
        const p = left.splice(bi, 1)[0], rr = Math.hypot(p.x, p.z) || 1, off = p.fp + 0.32;
        route.push({ x: p.x - (p.x / rr) * off, z: p.z - (p.z / rr) * off, plant: p }); from = p;
      }
      if (route.length) cr.visit(route);
    }
    lantern.flare = 1; sfx.chime();
    if (isFix(c)) { const target = touched.find((o) => o.k[0] !== "d" && o.p.alive)?.p; if (target && cr) setTimeout(() => { if (idx === n && !villain) startFight(cr, target); }, 350); }
  }
  syncBoats(n, stepped);
  hourWant = n >= 0 ? localHour(data.commits[n]) : GOLDEN;
  updateUI();
  if (story.kind) renderStory();
}

// ---------------------------------------------------------------- per-frame plant animation
const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const WILT = col("#7b5a3c"), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const SWAYS = new Set(["tree", "pine", "flower", "shrub", "grass"]);
const HEAT = [[0, "#3f4f57"], [0.35, "#7d8a6a"], [0.65, "#e0a64a"], [1, "#ff7a3a"]].map(([t, c]) => [t, col(c)]);
const DIM = col("#37413c"), SICK = col("#6f4a7e"), _hc = new THREE.Color();
function heatColor(h, out) {
  for (let i = 1; i < HEAT.length; i++) if (h <= HEAT[i][0]) return out.copy(HEAT[i - 1][1]).lerp(HEAT[i][1], (h - HEAT[i - 1][0]) / (HEAT[i][0] - HEAT[i - 1][0]));
  return out.copy(HEAT[HEAT.length - 1][1]);
}
let heatMode = false, following = null, followT0 = 0;
function updatePlants(dt, t) {
  const mine = following ? state.byAuthor[following.i] : null, logMax = Math.log(Math.max(2, state.maxTouched));
  for (const p of plants) {
    let target;
    if (p.alive) { p.w = Math.max(0, p.w - dt * 3); target = t >= p.delay ? 1 : 0; }
    else { if (p.g > 0.02 || p.w > 0) p.w = Math.min(1, p.w + dt * 1.15); target = p.w >= 0.7 || p.g < 0.02 ? 0 : 1; }
    p.v += ((target - p.g) * 60 - p.v * 8.5) * dt;
    p.g = Math.max(0, p.g + p.v * dt);
    if (target === 0 && p.g < 0.01) { p.g = 0; p.v = 0; if (!p.alive) p.w = 0; }
    p.S += (p.St - p.S) * Math.min(1, dt * 3.5);
    p.pulse = Math.max(0, p.pulse - dt * 1.5);
    p.shake = Math.max(0, p.shake - dt * 3);
    p.sick = p.nibbling ? Math.min(1, p.sick + dt * 0.9) : Math.max(0, p.sick - dt * 1.1);
    const gs = p.g * p.S * (1 + 0.16 * p.pulse) * (p.hover ? 1.07 : 1) * (p.selected ? 1 + 0.05 * Math.sin(t * 4) : 1);
    if (gs < 0.003) { for (const part of p.parts) part.mesh.setMatrixAt(part.slot, ZERO); continue; }
    const sway = (SWAYS.has(p.kind) ? Math.sin(t * (1.15 + wx.cur.wind * 1.4) + p.phase) * (0.03 + wx.cur.wind * 0.07) * (1 - p.w) : 0) + Math.sin(t * 38) * 0.08 * p.shake;
    _q.setFromAxisAngle(p.tiltAxis, p.w * 0.75 + sway).multiply(_qy.setFromAxisAngle(UP, p.yaw));
    _b.compose(_v.set(p.x, p.y - p.w * 0.1 * p.S, p.z), _q, _s.set(gs, gs, gs));
    if (heatMode) heatColor(Math.log(Math.max(1, state.touched[p.i])) / logMax, _hc);
    const dim = mine && !mine.has(p.i);
    for (const part of p.parts) {
      part.mesh.setMatrixAt(part.slot, _m.multiplyMatrices(_b, part.local));
      _c.copy(part.color);
      if (heatMode) _c.lerp(_hc, 0.88);
      if (dim) _c.lerp(DIM, 0.72);
      if (p.sick > 0) _c.lerp(SICK, p.sick * 0.55);
      if (p.w > 0) _c.lerp(WILT, p.w * 0.85);
      part.mesh.setColorAt(part.slot, _c);
    }
  }
  for (const m of Object.values(meshes)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

// ---------------------------------------------------------------- UI
const picker = $("repoPicker");
for (const r of REPOS) {
  const b = document.createElement("button"); b.type = "button"; b.textContent = r.id; b.dataset.id = r.id;
  b.addEventListener("click", () => { if (location.hash.slice(1) !== r.id) location.hash = r.id; else loadRepo(r.id); });
  picker.appendChild(b);
}
const guideBtn = $("guideBtn"), guidePanel = $("guidePanel");
guideBtn.addEventListener("click", () => { const open = guidePanel.hidden; guidePanel.hidden = !open; guideBtn.setAttribute("aria-expanded", String(open)); });
if (innerWidth > 1280) { guidePanel.hidden = false; guideBtn.setAttribute("aria-expanded", "true"); }
const guideList = $("guideList");
guideList.innerHTML = Object.entries(KINDS).map(([k, v]) => `<li data-kind="${k}"><svg viewBox="0 0 22 22" aria-hidden="true">${KIND_ICON[k]}</svg><span><span class="nm">${v.name}</span><span class="ds">${v.desc}</span></span><span class="ct">0</span></li>`).join("") +
  `<li><svg viewBox="0 0 22 22" aria-hidden="true"><ellipse cx="11" cy="14" rx="7" ry="6" fill="#a3c76c"/><circle cx="8.6" cy="13.2" r="1.1" fill="#161616"/><circle cx="13.4" cy="13.2" r="1.1" fill="#161616"/><path d="M11 8V5.5c1.5-.8 3-.5 3.6.3-1 .9-2.4 1-3.6.4" fill="#8cc05a"/></svg><span><span class="nm">Mosslings</span><span class="ds">One per person who committed. They tend the files they touched.</span></span><span class="ct" id="ctCreatures">0</span></li>` +
  `<li><svg viewBox="0 0 22 22" aria-hidden="true"><path d="M3 13h16a8 5 0 0 1-16 0z" fill="#f0b77f"/><circle cx="16" cy="14.5" r=".9" fill="#1a1a1a"/><rect x="9.4" y="3" width="1.2" height="10" fill="#7a5a3e"/><path d="M10 13c-3-2-3-7 0-10 3 3 3 8 0 10z" fill="#7fbf5a"/></svg><span><span class="nm">Boats</span><span class="ds">Merged pull requests. The leaf sail&#39;s colour shows the branch type.</span></span><span class="ct" id="ctBoats">0</span></li>`;

const framesEl = $("frames"), strip = $("strip"), playBtn = $("play");
const ICON_PLAY = '<path d="M5 3.2v11.6c0 .6.7 1 1.2.6l8.6-5.8c.4-.3.4-1 0-1.3L6.2 2.6c-.5-.4-1.2 0-1.2.6z"/>';
const ICON_PAUSE = '<rect x="4" y="3" width="3.6" height="12" rx="1"/><rect x="10.4" y="3" width="3.6" height="12" rx="1"/>';
const ICON_REPLAY = '<path d="M9 3a6 6 0 1 1-5.6 3.9l1.7.7A4.2 4.2 0 1 0 9 4.8V7L5.4 3.9 9 .8z"/>';

function buildStrip() {
  const tot = data.commits.map((c) => c.c.reduce((s, [, a, d]) => s + a + d, 0)), mx = Math.log(1 + Math.max(1, ...tot));
  framesEl.innerHTML = data.commits.map((c, i) => `<div class="frame${isFix(c) ? " bug" : ""}" style="--c:${creatures[c.a]?.color || "#999"}"><i style="height:${(18 + 82 * Math.log(1 + tot[i]) / mx).toFixed(1)}%"></i></div>`).join("");
  strip.setAttribute("aria-valuemax", String(data.commits.length));
}

function setPlayIcon() {
  const atEnd = idx >= data.commits.length - 1;
  $("playIcon").innerHTML = playing ? ICON_PAUSE : atEnd ? ICON_REPLAY : ICON_PLAY;
  playBtn.setAttribute("aria-label", playing ? "Pause" : atEnd ? "Replay from the first commit" : "Play history");
}

function updateUI() {
  const n = data.commits.length, c = data.commits[idx];
  let alive = 0; const counts = {}; for (const k in KINDS) counts[k] = 0;
  for (const p of plants) if (p.alive) { alive++; counts[p.kind]++; }
  $("stAlive").textContent = alive;
  $("ctBoats").textContent = data.commits.slice(0, idx + 1).filter(mergeInfo).length;
  const bugs = data.commits.slice(0, idx + 1).filter(isFix).length;
  $("stBugs").innerHTML = `<b>${bugs}</b> bug${bugs === 1 ? "" : "s"} squashed`;
  for (const li of guideList.querySelectorAll("li[data-kind]")) li.querySelector(".ct").textContent = counts[li.dataset.kind];
  [...framesEl.children].forEach((f, i) => { f.classList.toggle("past", i <= idx); f.classList.toggle("now", i === idx); });
  strip.setAttribute("aria-valuenow", String(idx + 1));
  strip.setAttribute("aria-valuetext", c ? `Commit ${idx + 1} of ${n}: ${c.m}` : "Before the first commit");
  if (!c) {
    $("cMeta").textContent = `Before the first commit · ${n} to come`;
    $("cMsg").textContent = "A bare island.";
    $("cBy").innerHTML = '<span>Press play, or drag along the film strip.</span>';
    $("stamp").textContent = "Unplanted";
  } else {
    const add = c.c.reduce((s, x) => s + x[1], 0), del = c.c.reduce((s, x) => s + x[2], 0);
    const cr = creatures[c.a];
    const hr = localHour(c);
    pickWeather();
    $("cMeta").textContent = `Commit ${idx + 1} of ${n} · ${c.h} · ${clockOf(hr)} ${partOfDay(hr)} · ${wx.label}`;
    $("cMsg").textContent = c.m;
    $("cBy").innerHTML = `<button class="who" data-a="${c.a}" style="--c:${cr.color}" title="Follow ${esc(cr.tagEl.textContent)}"><span class="dot"></span>${esc(cr.tagEl.textContent)}</button>${c.c.length ? `<span class="delta"><span class="plus">+${add}</span> <span class="minus">−${del}</span> in ${c.c.length} file${c.c.length === 1 ? "" : "s"}</span>` : '<span class="delta">Merge, no new changes</span>'}`;
    $("stamp").textContent = fmtDate(c.t);
    if (isFix(c) && !villain) setBattle("A bug-fix commit: a bug was squashed here.");
  }
  setPlayIcon();
}

function play() {
  if (!data) return;
  if (idx >= data.commits.length - 1) goTo(-1);
  playing = true; stepTimer = stepInterval * 0.6; setPlayIcon();
}
function pause() { playing = false; setPlayIcon(); }
playBtn.addEventListener("click", () => (playing ? pause() : play()));

function scrubTo(e) {
  const r = framesEl.getBoundingClientRect(), n = data.commits.length;
  const i = clamp(Math.floor(((e.clientX - r.left) / r.width) * n), 0, n - 1);
  if (i !== idx) goTo(i, i === idx + 1);
}
strip.addEventListener("pointerdown", (e) => { pause(); strip.setPointerCapture(e.pointerId); scrubTo(e); });
strip.addEventListener("pointermove", (e) => { if (strip.hasPointerCapture(e.pointerId)) scrubTo(e); });
strip.addEventListener("keydown", (e) => {
  const map = { ArrowRight: idx + 1, ArrowLeft: idx - 1, Home: -1, End: data.commits.length - 1 };
  if (e.key in map) { e.preventDefault(); pause(); goTo(map[e.key], e.key === "ArrowRight"); }
});
addEventListener("keydown", (e) => {
  if (e.key === " " && document.activeElement === document.body) { e.preventDefault(); playing ? pause() : play(); }
});

// ---------------------------------------------------------------- hover / tap labels
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const tag = $("tag");
let pointer = null, hovered = null, downAt = null;
canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") pointer = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerleave", () => { pointer = null; });
canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 7) return;
  const hit = pick({ x: e.clientX, y: e.clientY });
  if (hit?.boat) hit.boat.hop();
  else if (hit?.villain) hit.villain.bonk();
  else if (hit?.lantern) releaseBug();
  else if (hit?.plant) openFile(hit.plant.i, true);
  else if (hit?.creature) { hit.creature.pet(); follow(hit.creature); }
});

function pick(pt = pointer) {
  if (!pt || !data) return null;
  ndc.set((pt.x / innerWidth) * 2 - 1, -(pt.y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...Object.values(meshes), ...creatures.map((c) => c.hit), ...(villain ? [villain.hit] : []), ...boats.map((b) => b.hit), lantern], true);
  for (const h of hits) {
    if (h.object.userData.boat) return { boat: h.object.userData.boat };
    if (h.object.userData.villain) return { villain: h.object.userData.villain };
    let o = h.object; while (o && o !== lantern) o = o.parent;
    if (o === lantern) return { lantern: true };
    if (h.object.userData.creature) return { creature: h.object.userData.creature };
    if (h.instanceId != null) { const p = plants.byFile[h.object.userData.owner[h.instanceId]]; if (p && p.g > 0.2) return { plant: p }; }
  }
  return null;
}

function showTag(hit) {
  if (hovered?.plant) hovered.plant.hover = false;
  hovered = hit;
  if (!hit) { tag.hidden = true; return; }
  let html;
  if (hit.boat) {
    const b = hit.boat, c = data.commits[b.k];
    html = `<p class="k">Pull request</p><h3>${b.info.num ? "#" + b.info.num + " " : ""}${esc(b.info.branch)}</h3><dl><dt>Merged</dt><dd>${fmtDate(c.t)}</dd><dt>By</dt><dd>${esc(who(c.a))}</dd></dl><p class="last">Click the boat to say hi.</p>`;
  } else if (hit.villain) html = `<p class="k">Villain</p><h3>A bug</h3><dl><dt>Nibbling</dt><dd>${esc(data.files[hit.villain.plant.i].split("/").pop())}</dd></dl><p class="last">Click it to help bonk it.</p>`;
  else if (hit.lantern) html = `<p class="k">Lantern</p><h3>The commit lantern</h3><p class="last">It flares on every commit. Click it to let a bug loose for a practice fight.</p>`;
  else if (hit.plant) {
    const p = hit.plant, path = data.files[p.i], f = p.i;
    p.hover = true;
    const kindName = KINDS[p.kind].name.replace(/s$/, "");
    const sub = p.kind === "tree" && LANG[p.ext] ? `${kindName} · ${LANG[p.ext]}` : kindName;
    const born = state.born[f] >= 0 ? data.commits[state.born[f]] : null, last = state.last[f] >= 0 ? data.commits[state.last[f]] : null;
    const binary = data.commits.some((c) => c.c.some((x) => x[0] === f && x[3].length > 1));
    html = `<p class="k">${esc(sub)}</p><h3>${esc(path.split("/").pop())}</h3><p class="p">${esc(path)}</p><dl>` +
      (binary ? "<dt>Kind</dt><dd>Binary file</dd>" : `<dt>Lines</dt><dd>${Math.round(state.lines[f]).toLocaleString("en-GB")}</dd>`) +
      (born ? `<dt>Planted</dt><dd>${fmtDate(born.t)}</dd>` : "") +
      `<dt>Touched in</dt><dd>${state.touched[f]} commit${state.touched[f] === 1 ? "" : "s"}</dd></dl>` +
      (last ? `<p class="last">Last: ${esc(last.m)}</p>` : "");
  } else {
    const c = hit.creature, mine = data.commits.filter((x) => x.a === c.i).length;
    html = `<p class="k">${c.author.bot ? "Automation" : "Gardener"}</p><h3>${esc(c.tagEl.textContent)}</h3><dl><dt>Commits</dt><dd>${mine} of ${data.commits.length}</dd><dt>Share</dt><dd>${Math.round((mine / data.commits.length) * 100)}%</dd></dl>`;
  }
  tag.innerHTML = html; tag.hidden = false;
  const w = tag.offsetWidth, h = tag.offsetHeight;
  let x = pointer.x + 16, y = pointer.y + 16;
  if (x + w > innerWidth - 12) x = pointer.x - w - 16;
  if (y + h > innerHeight - 12) y = pointer.y - h - 16;
  tag.style.transform = `translate(${Math.max(12, x)}px, ${Math.max(12, y)}px)`;
}

// ---------------------------------------------------------------- labels projected over the canvas
const _p = new THREE.Vector3();
let blockers = [];
function place(el, v) {
  _p.copy(v).project(camera);
  const x = ((_p.x + 1) / 2) * innerWidth, y = ((1 - _p.y) / 2) * innerHeight;
  const covered = blockers.some((b) => x > b.left - 50 && x < b.right + 50 && y > b.top - 4 && y < b.bottom + 24);
  if (_p.z > 1 || x < 56 || x > innerWidth - 56 || y < 30 || y > innerHeight - 10 || covered) { el.style.visibility = "hidden"; return; }
  el.style.visibility = "visible";
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}
function updateLabels() {
  blockers = [...document.querySelectorAll(".label-card, .tools, .commit, .strip-row, .guide-btn, .guide-panel:not([hidden]), .story:not([hidden]), .results:not([hidden])")].map((e) => e.getBoundingClientRect());
  for (const s of signs) place(s.el, s.pos);
  const active = data?.commits[idx]?.a;
  for (const c of creatures) {
    const show = c.i === active || hovered?.creature === c || following === c;
    c.tagEl.style.opacity = show ? 1 : 0;
    if (show) place(c.tagEl, _v.set(c.group.position.x, c.group.position.y + (c.author.bot ? 1.1 : 0.95) + c.body.position.y, c.group.position.z));
  }
}

// ---------------------------------------------------------------- load a garden
async function loadRepo(id, custom) {
  const meta = custom ? { id: null, owner: "your garden · only on this device" } : REPOS.find((r) => r.id === id) || REPOS[0];
  const inline = custom ? null : document.getElementById(`garden-${meta.id}`); // single-file builds embed the gardens
  if (custom) data = custom;
  else if (inline) data = JSON.parse(inline.textContent);
  else {
    const res = await fetch(`data/${meta.id}.json`);
    if (!res.ok) throw new Error(`Could not load data/${meta.id}.json`);
    data = await res.json();
  }
  pause(); idx = -1; hovered = null; tag.hidden = true;
  following = null; closeStory(); $("followChip").hidden = true; findInput.value = ""; results.hidden = true;
  cancelFight();
  for (const b of boats) b.dispose(); boats = [];
  for (const c of creatures) c.dispose();
  layout(); buildTerrain(); buildPlantMeshes(); buildSigns();
  creatures = data.authors.map((a, i) => new Creature(a, i, data.authors.length));
  buildStrip();
  stepInterval = clamp(26 / data.commits.length, 0.9, 1.7);
  const churns = data.commits.map((c) => c.c.reduce((s2, x) => s2 + x[1] + x[2], 0)).sort((a, b) => a - b);
  wx.churnTop = Math.max(150, churns[Math.floor(churns.length * 0.8)] || 150);
  $("repoName").textContent = data.name;
  $("owner").textContent = meta.owner;
  $("stCommits").textContent = data.commits.length;
  $("stGardeners").textContent = data.authors.length;
  $("ctCreatures").textContent = data.authors.length;
  for (const b of picker.children) b.setAttribute("aria-pressed", String(b.dataset.id === meta.id));
  document.title = `Mossgit · ${data.name}`;
  if (reduceMotion) goTo(data.commits.length - 1);
  else { goTo(-1); if (started) setTimeout(play, 500); }
}
addEventListener("hashchange", () => loadRepo(location.hash.slice(1)));

// ---------------------------------------------------------------- follow, fly, find, hot spots
const _ft = new THREE.Vector3(), _fo = new THREE.Vector3();
let heatTick = 0;
const followChip = $("followChip");
function follow(c) {
  window.gsap?.killTweensOf(camera.position); window.gsap?.killTweensOf(controls.target);
  following = c; followT0 = clock.elapsedTime; lastInteract = clock.elapsedTime;
  followChip.innerHTML = `<span class="dot" style="--c:${c.color}"></span>Following ${esc(c.tagEl.textContent)}<span class="x" aria-hidden="true">×</span>`;
  followChip.setAttribute("aria-label", `Stop following ${c.tagEl.textContent}`);
  followChip.hidden = false;
  openGardener(c);
}
function unfollow() { following = null; followChip.hidden = true; if (story.kind === "gardener") closeStory(); }
followChip.addEventListener("click", unfollow);
$("cBy").addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) { const c = creatures[+b.dataset.a]; c.pet(); follow(c); } });

function flyTo(x, y, z) {
  following = null; followChip.hidden = true; lastInteract = clock.elapsedTime;
  const dir = _fo.copy(camera.position).sub(controls.target).normalize();
  const dist = Math.min(camera.position.distanceTo(controls.target), 16);
  const end = new THREE.Vector3(x, y + 0.5, z), pos = end.clone().addScaledVector(dir, dist);
  if (reduceMotion || !window.gsap) { controls.target.copy(end); camera.position.copy(pos); return; }
  window.gsap.to(controls.target, { x: end.x, y: end.y, z: end.z, duration: 1.1, ease: "power2.inOut" });
  window.gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: 1.1, ease: "power2.inOut" });
}

const heatBtn = $("heatBtn");
heatBtn.addEventListener("click", () => {
  heatMode = !heatMode; heatTick = 1;
  heatBtn.setAttribute("aria-pressed", String(heatMode)); $("ramp").hidden = !heatMode;
});

// keep the story panel clear of the deck
new ResizeObserver(([e]) => document.documentElement.style.setProperty("--deck-h", `${Math.ceil(e.target.getBoundingClientRect().height)}px`)).observe(document.querySelector(".deck"));

// ---------------------------------------------------------------- life stories
const story = { kind: null, f: -1, c: null };
const storyEl = $("story"), storyBody = $("storyBody");
$("storyClose").addEventListener("click", () => (story.kind === "gardener" ? unfollow() : closeStory()));
function closeStory() {
  if (story.f >= 0 && plants.byFile?.[story.f]) plants.byFile[story.f].selected = false;
  story.kind = null; story.f = -1; story.c = null; storyEl.hidden = true;
}
function openStory() {
  storyEl.hidden = false;
  if (!guidePanel.hidden) { guidePanel.hidden = true; guideBtn.setAttribute("aria-expanded", "false"); }
  renderStory();
}
function openFile(f, fly) {
  if (story.f >= 0 && plants.byFile[story.f]) plants.byFile[story.f].selected = false;
  if (story.kind === "gardener") { following = null; followChip.hidden = true; }
  story.kind = "file"; story.f = f; story.c = null;
  const p = plants.byFile[f];
  if (p) { p.selected = true; p.pulse = 1; if (fly) flyTo(p.x, p.y, p.z); }
  openStory(); storyBody.scrollTop = 0;
}
function openGardener(c) {
  if (story.f >= 0 && plants.byFile[story.f]) plants.byFile[story.f].selected = false;
  story.kind = "gardener"; story.c = c; story.f = -1;
  openStory(); storyBody.scrollTop = 0;
}
function renderStory() {
  if (story.kind === "plant") return;
  if (story.kind === "file") storyBody.innerHTML = fileStory(story.f);
  else if (story.kind === "gardener") storyBody.innerHTML = gardenerStory(story.c);
}
storyBody.addEventListener("click", (e) => {
  const b = e.target.closest("[data-k], [data-f]");
  if (!b) return;
  if (b.dataset.k != null) { pause(); goTo(+b.dataset.k, +b.dataset.k === idx + 1); }
  else openFile(+b.dataset.f, true);
});

const who = (a) => creatures[a]?.tagEl.textContent || data.authors[a].name;
function commitRow(k, label) {
  const c = data.commits[k];
  return `<li><button data-k="${k}" aria-current="${k === idx}" title="Show this commit"><span class="dot" style="--c:${creatures[c.a].color}"></span><span class="m">${esc(label ?? c.m)}</span><span class="w">${fmtDate(c.t)}</span></button></li>`;
}

function fileStory(f) {
  const n = data.commits.length, path = data.files[f], p = plants.byFile[f];
  const ys = new Array(n).fill(null), touches = [];
  let lines = 0, alive = false;
  data.commits.forEach((c, k) => {
    for (const [ff, a, d, kind] of c.c) if (ff === f) {
      touches.push(k);
      if (kind[0] === "d") { alive = false; lines = 0; }
      else { if (!alive) { alive = true; lines = 0; } lines = kind.length > 1 ? 40 : Math.max(1, lines + a - d); }
    }
    ys[k] = alive ? lines : null;
  });
  const binary = data.commits.some((c) => c.c.some((x) => x[0] === f && x[3].length > 1));
  const W = 300, H = 92, top = 14, bot = 18, maxV = Math.max(1, ...ys.filter((v) => v != null));
  const X = (k) => (n === 1 ? W / 2 : 5 + (k * (W - 10)) / (n - 1)), Y = (v) => top + (1 - v / maxV) * (H - top - bot);
  let line = "", area = "", run = [];
  const flush = () => {
    if (!run.length) return;
    let d = `M${X(run[0]).toFixed(1)},${Y(ys[run[0]]).toFixed(1)}`;
    for (let i = 1; i < run.length; i++) d += `H${X(run[i]).toFixed(1)}V${Y(ys[run[i]]).toFixed(1)}`;
    const endX = run.length > 1 ? X(run[run.length - 1]) : X(run[0]) + 3;
    if (run.length === 1) d += `H${endX.toFixed(1)}`;
    line += d; area += `${d}V${(H - bot).toFixed(1)}H${X(run[0]).toFixed(1)}Z`; run = [];
  };
  ys.forEach((v, k) => (v == null ? flush() : run.push(k))); flush();
  const nowX = idx >= 0 ? X(idx) : null;
  const dots = touches.map((k) => `<circle data-k="${k}" cx="${X(k).toFixed(1)}" cy="${Y(ys[k] ?? 0).toFixed(1)}" r="${k === idx ? 5 : 3.6}" fill="${creatures[data.commits[k].a].color}" stroke="#1d2924" stroke-width="${k === idx ? 1.6 : 0.8}"><title>${esc(data.commits[k].m)}</title></circle>`).join("");
  const chart = binary ? "" : `<h3>Lines over time</h3><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Line count of ${esc(path)} across the history, peaking at ${maxV} lines">
    <line x1="0" x2="${W}" y1="${H - bot}" y2="${H - bot}" stroke="currentColor" stroke-opacity=".25"/>
    ${nowX != null ? `<line x1="${nowX}" x2="${nowX}" y1="2" y2="${H - bot}" stroke="#2b6668" stroke-dasharray="3 3" stroke-width="1.2"/>` : ""}
    <path d="${area}" fill="#5c8a4a" fill-opacity=".18"/><path d="${line}" fill="none" stroke="#3f6a3a" stroke-width="1.6" stroke-linejoin="round"/>
    ${dots}
    <text x="0" y="9">${maxV.toLocaleString("en-GB")} lines</text>
    <text x="0" y="${H - 4}">${fmtDate(data.commits[0].t)}</text><text x="${W}" y="${H - 4}" text-anchor="end">${fmtDate(data.commits[n - 1].t)}</text>
  </svg>`;

  const first = touches[0], kindName = KINDS[p.kind].name.replace(/s$/, "");
  const sub = p.kind === "tree" && LANG[p.ext] ? `${kindName} · ${LANG[p.ext]}` : kindName;
  let note;
  if (state.alive[f]) note = `Planted ${fmtDate(data.commits[state.born[f]].t)} by ${esc(who(data.commits[state.born[f]].a))}.`;
  else if (first > idx) note = `Not planted yet at this point in the history. It first appears in commit ${first + 1}.<br><button class="jump" data-k="${first}">Jump to commit ${first + 1}</button>`;
  else note = `Wilted ${fmtDate(data.commits[state.died[f]].t)}, when the file was deleted.`;
  const hands = [...new Set(touches.map((k) => data.commits[k].a))];
  return `<p class="k">${esc(sub)}</p><h2>${esc(path.split("/").pop())}</h2><p class="p">${esc(path)}</p>
    <p class="note">${note}</p>
    <dl>${binary ? "<dt>Kind</dt><dd>Binary file</dd>" : `<dt>Lines now</dt><dd>${state.alive[f] ? Math.round(state.lines[f]).toLocaleString("en-GB") : "–"}</dd>`}
      <dt>Touched in</dt><dd>${touches.length} of ${n} commits</dd>
      <dt>Tended by</dt><dd>${hands.map((a) => esc(who(a))).join(", ")}</dd></dl>
    ${chart}
    <h3>Commits that touched it</h3><ol>${touches.slice().reverse().slice(0, 8).map((k) => commitRow(k)).join("")}</ol>`;
}

function gardenerStory(c) {
  const mine = data.commits.map((x, k) => [x, k]).filter(([x]) => x.a === c.i), N = data.commits.length;
  let add = 0, del = 0; const fileCount = new Map(), patch = new Map(), hours = new Array(24).fill(0);
  for (const [x] of mine) {
    hours[Math.floor(localHour(x))]++;
    for (const [f, a, d] of x.c) {
      add += a; del += d; fileCount.set(f, (fileCount.get(f) || 0) + 1);
      const sec = plants.byFile[f]?.sector.name; if (sec != null) patch.set(sec, (patch.get(sec) || 0) + 1);
    }
  }
  const fav = [...patch].sort((a, b) => b[1] - a[1])[0];
  const lateShare = mine.length ? (hours.slice(22).concat(hours.slice(0, 5)).reduce((a, b) => a + b, 0) / mine.length) : 0;
  const earlyShare = mine.length ? hours.slice(5, 11).reduce((a, b) => a + b, 0) / mine.length : 0;
  let best = 0, bestAt = 0; for (let h = 0; h < 24; h++) { const s3 = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24]; if (s3 > best) { best = s3; bestAt = h; } }
  const rhythm = lateShare >= 0.35 ? `Night owl: ${Math.round(lateShare * 100)}% of their commits land between 10 pm and 5 am.`
    : earlyShare >= 0.5 ? `Early bird: ${Math.round(earlyShare * 100)}% of their commits land before 11 am.`
    : `Busiest between ${clockOf(bestAt)} and ${clockOf((bestAt + 3) % 24)}.`;
  const W = 300, H = 66, bw = W / 24, mx = Math.max(1, ...hours);
  const bars = hours.map((v, h) => `<rect x="${(h * bw + 1).toFixed(1)}" y="${(50 - (v / mx) * 44).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${((v / mx) * 44 + (v ? 0 : 1.5)).toFixed(1)}" rx="1.5" fill="${v ? c.color : "currentColor"}" fill-opacity="${v ? 1 : 0.15}" stroke="${v ? "#1d2924" : "none"}" stroke-width=".6"><title>${clockOf(h)}: ${v} commit${v === 1 ? "" : "s"}</title></rect>`).join("");
  const ticks = [0, 6, 12, 18].map((h) => `<text x="${(h * bw + 1).toFixed(1)}" y="${H - 3}">${String(h).padStart(2, "0")}:00</text>`).join("");
  const top = [...fileCount].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<p class="k">${c.author.bot ? "Automation" : "Gardener"}</p><h2>${esc(c.tagEl.textContent)}</h2>
    <p class="note">${c.pets ? `Petted ${c.pets} time${c.pets === 1 ? "" : "s"} today. ` : ""}Tap other creatures to follow them instead.</p>
    <dl><dt>Commits</dt><dd>${mine.length} of ${N} (${Math.round((mine.length / N) * 100)}%)</dd>
      <dt>Lines</dt><dd><span style="color:#3d7a35">+${add.toLocaleString("en-GB")}</span> <span style="color:#a14d38">−${del.toLocaleString("en-GB")}</span></dd>
      <dt>Files touched</dt><dd>${fileCount.size}</dd>
      ${fav ? `<dt>Favourite patch</dt><dd>${esc(fav[0] ? fav[0] + "/" : "root")}</dd>` : ""}</dl>
    <h3>When they commit (local time)</h3>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Commits by hour of day. ${esc(rhythm)}">${bars}${ticks}</svg>
    <p class="note">${rhythm}</p>
    ${top.length ? `<h3>Files they tend most</h3><ol>${top.map(([f, k]) => `<li><button data-f="${f}"><span class="dot" style="--c:${c.color}"></span><span class="m">${esc(data.files[f])}</span><span class="w">${k}×</span></button></li>`).join("")}</ol>` : ""}
    <h3>Their latest commits</h3><ol>${mine.slice(-5).reverse().map(([, k]) => commitRow(k)).join("")}</ol>`;
}

// ---------------------------------------------------------------- find a file
const findInput = $("findInput"), results = $("results");
let resList = [], resIdx = 0;
function search() {
  const q = findInput.value.trim().toLowerCase();
  if (!q || !data) { results.hidden = true; findInput.setAttribute("aria-expanded", "false"); return; }
  const scored = [];
  data.files.forEach((path, i) => {
    const l = path.toLowerCase(), b = l.split("/").pop();
    const s = b === q ? 0 : b.startsWith(q) ? 1 : b.includes(q) ? 2 : l.includes(q) ? 3 : -1;
    if (s >= 0) scored.push([s, path.length, i]);
  });
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  resList = scored.slice(0, 7).map((x) => x[2]); resIdx = 0;
  results.innerHTML = resList.length ? resList.map((f, i) => {
    const status = state.alive[f] ? "" : state.born[f] < 0 && state.died[f] < 0 ? " · not planted yet" : " · wilted";
    return `<li><button type="button" role="option" id="res${i}" data-i="${i}" aria-selected="${i === resIdx}"><span class="b">${esc(data.files[f].split("/").pop())}</span><span class="d">${esc(data.files[f])}${status}</span></button></li>`;
  }).join("") : '<li class="none">No file by that name in this garden.</li>';
  results.hidden = false; findInput.setAttribute("aria-expanded", "true");
}
function choose(i) {
  const f = resList[i]; if (f == null) return;
  findInput.value = ""; results.hidden = true; findInput.setAttribute("aria-expanded", "false"); findInput.blur();
  openFile(f, true);
}
findInput.addEventListener("input", search);
findInput.addEventListener("focus", search);
findInput.addEventListener("blur", () => setTimeout(() => { results.hidden = true; findInput.setAttribute("aria-expanded", "false"); }, 150));
findInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!resList.length) return;
    resIdx = (resIdx + (e.key === "ArrowDown" ? 1 : resList.length - 1)) % resList.length;
    for (const b of results.querySelectorAll("button")) b.setAttribute("aria-selected", String(+b.dataset.i === resIdx));
    findInput.setAttribute("aria-activedescendant", `res${resIdx}`);
  } else if (e.key === "Enter") { e.preventDefault(); choose(resIdx); }
  else if (e.key === "Escape") { findInput.value = ""; search(); findInput.blur(); }
});
results.addEventListener("pointerdown", (e) => e.preventDefault());
results.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) choose(+b.dataset.i); });
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input")) return;
  if (e.key === "/") { e.preventDefault(); findInput.focus(); }
  else if (e.key === "Escape") { if (following) unfollow(); else closeStory(); }
});
// ---------------------------------------------------------------- boats: one per merged pull request
const MERGE_RE = /^Merge pull request #(\d+) from (\S+)/, BRANCH_RE = /^Merge branch '([^']+)'/;
function mergeInfo(c) {
  let m = MERGE_RE.exec(c.m);
  if (m) return { num: +m[1], branch: m[2].replace(/^[^/]+\//, "") };
  m = BRANCH_RE.exec(c.m); return m ? { num: null, branch: m[1] } : null;
}
// leaf sails, coloured by branch type like the seasons
const SAILS = { feat: "#7fbf5a", feature: "#7fbf5a", fix: "#e8954a", hotfix: "#e8954a", bugfix: "#e8954a", chore: "#e6c04a", ci: "#5aae90", docs: "#c4d468", test: "#93c85e", tests: "#93c85e", refactor: "#d65f48", perf: "#d65f48", claude: "#efb25a" };
const HULLS = ["#f0b77f", "#ec9e88", "#93c6d8", "#f2d07c", "#b9d98f"];
const sailColor = (branch) => SAILS[branch.split(/[/_-]/)[0].toLowerCase()] || "#86b85a";
function leafGeo() {
  const sh = new THREE.Shape(); sh.moveTo(0, 0);
  sh.bezierCurveTo(0.44, 0.16, 0.42, 0.72, 0, 1.05); sh.bezierCurveTo(-0.42, 0.72, -0.44, 0.16, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, x * x * 1.1 + Math.sin(y * Math.PI) * 0.06); }
  g.computeVertexNormals(); return g;
}
const boatGeo = {
  hull: new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  rim: new THREE.TorusGeometry(0.5, 0.05, 6, 28),
  deck: new THREE.CircleGeometry(0.48, 24),
  mast: new THREE.CylinderGeometry(0.022, 0.028, 0.95, 6),
  sail: leafGeo(),
  rib: new THREE.CylinderGeometry(0.012, 0.018, 1.02, 5).translate(0, 0.51, 0),
  flag: new THREE.BoxGeometry(0.17, 0.1, 0.012),
  eye: new THREE.SphereGeometry(0.036, 10, 8),
  glint: new THREE.SphereGeometry(0.012, 6, 5),
  cheek: new THREE.SphereGeometry(0.032, 8, 6),
};
const boatMats = new Map();
const boatMat = (hex, rough = 0.55, side = THREE.FrontSide) => { const k = hex + rough + side; if (!boatMats.has(k)) boatMats.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, side, flatShading: side === THREE.DoubleSide })); return boatMats.get(k); };
const waterTime = { value: 0 };
function waveAt(x, z, t) {
  const wy = -z, amp = smoothstep(R, R + 6, Math.hypot(x, z));
  return (0.13 * Math.sin(x * 0.35 + t * 0.9) + 0.085 * Math.sin(wy * 0.42 - t * 0.7) + 0.045 * Math.sin((x + wy) * 0.8 + t * 1.6)) * (0.3 + 0.7 * amp) * waveAmp.value;
}
let boats = [];
class Boat {
  constructor(k, info, i, arriving) {
    const c = data.commits[k];
    this.k = k; this.info = info; this.author = c.a; this.phase = Math.random() * 6.28; this.hopT = 0;
    const g = new THREE.Group(), body = new THREE.Group(); this.group = g; this.body = body; g.add(body);
    const hullC = HULLS[(info.num ?? i) % HULLS.length], sail = sailColor(info.branch);
    this.sail = sail;
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; body.add(m); return m; };
    this.hit = add(boatGeo.hull, boatMat(hullC), 0, 0.22, 0, 1.25, 0.75, 0.8); this.hit.userData.boat = this;
    add(boatGeo.rim, boatMat(creatures[c.a]?.color || "#ffd27a", 0.6), 0, 0.22, 0, 1.25, 0.8, 0.7, Math.PI / 2);
    add(boatGeo.deck, boatMat("#c98f5a", 0.8), 0, 0.2, 0, 1.22, 0.78, 1, -Math.PI / 2);
    for (const s of [-1, 1]) {
      add(boatGeo.eye, boatMat("#1a1a1a", 0.3), 0.57, 0.12, 0.14 * s);
      add(boatGeo.glint, boatMat("#ffffff", 0.2), 0.6, 0.135, 0.14 * s + 0.012);
      add(boatGeo.cheek, boatMat("#f29a8d", 0.9), 0.5, 0.06, 0.25 * s, 0.5, 0.55, 1);
    }
    add(boatGeo.mast, boatMat("#7a5a3e", 0.8), 0, 0.42, 0, 1, 0.5, 1);
    this.sailMesh = add(boatGeo.sail, boatMat(sail, 0.7, THREE.DoubleSide), 0, 0.6, 0, 1, 1, 1, 0, 0, 0.06);
    add(boatGeo.rib, boatMat(new THREE.Color(sail).offsetHSL(0, 0, -0.2).getStyle(), 0.8), 0, 0.6, 0.01, 1, 1, 1, 0, 0, 0.06);
    // moorings spread round the island
    const ang = i * 2.39996 + 0.6, rad = R + 3.7 + (i % 3) * 1.0;
    this.home = new THREE.Vector3(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
    this.tangent = Math.atan2(-Math.cos(ang), -Math.sin(ang));
    this.start = new THREE.Vector3(Math.cos(ang) * 58, 0, Math.sin(ang) * 58);
    this.pos = arriving ? this.start.clone() : this.home.clone();
    this.heading = arriving ? Math.atan2(-(this.home.z - this.start.z), this.home.x - this.start.x) : this.tangent;
    this.t = arriving ? 0 : 99; this.sailing = arriving; this.wake = 0;
    this.tagEl = document.createElement("div"); this.tagEl.className = "nametag"; this.tagEl.style.setProperty("--c", sail);
    this.tagEl.textContent = info.num ? `PR #${info.num} · ${info.branch}` : info.branch; this.tagEl.style.opacity = 0;
    labelsEl.appendChild(this.tagEl); this.showTag = arriving ? 99 : 0;
    g.scale.setScalar(1.5);
    scene.add(g);
    if (arriving) sfx.toot();
  }
  hop() { this.hopT = 0.9; this.showTag = 3; sfx.toot(); }
  update(dt, t) {
    if (this.sailing) {
      this.t += dt;
      const k = Math.min(1, this.t / 6), e = 1 - (1 - k) ** 3;
      this.pos.lerpVectors(this.start, this.home, e);
      if ((this.wake -= dt) < 0 && k < 0.95) {
        this.wake = 0.18;
        const bx = -Math.cos(this.heading), bz = Math.sin(this.heading);
        dust(this.pos.x + bx * 0.7, waveAt(this.pos.x, this.pos.z, t) + 0.05, this.pos.z + bz * 0.7, 2, "#ffffff");
      }
      if (k >= 1) { this.sailing = false; this.showTag = 2.5; sfx.splash(); }
    } else {
      let d = ((this.tangent - this.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.heading += d * Math.min(1, dt * 0.6);
      this.pos.x = this.home.x + Math.sin(t * 0.25 + this.phase) * 0.18; this.pos.z = this.home.z + Math.cos(t * 0.21 + this.phase) * 0.18;
    }
    const y = waveAt(this.pos.x, this.pos.z, t);
    const sx = (waveAt(this.pos.x + 0.4, this.pos.z, t) - waveAt(this.pos.x - 0.4, this.pos.z, t)) / 0.8;
    const sz = (waveAt(this.pos.x, this.pos.z + 0.4, t) - waveAt(this.pos.x, this.pos.z - 0.4, t)) / 0.8;
    this.group.position.set(this.pos.x, y - 0.02, this.pos.z);
    this.group.rotation.set(sz * 0.8, this.heading, -sx * 0.8, "YXZ");
    this.body.rotation.x = Math.sin(t * 1.3 + this.phase) * (0.06 + wx.cur.wind * 0.1);
    this.sailMesh.scale.z = 1 + Math.sin(t * 1.7 + this.phase) * 0.15 + wx.cur.wind * 0.6;
    if (this.hopT > 0) { this.hopT = Math.max(0, this.hopT - dt); const k = 1 - this.hopT / 0.9; this.body.position.y = Math.sin(k * Math.PI) * 0.45; this.body.rotation.z = Math.sin(k * Math.PI * 2) * 0.25; }
    else { this.body.position.y = 0; this.body.rotation.z = 0; }
    this.showTag -= dt;
    const show = this.showTag > 0 || hovered?.boat === this;
    this.tagEl.style.opacity = show ? 1 : 0;
    if (show) place(this.tagEl, _v.set(this.group.position.x, this.group.position.y + 1.9 + this.body.position.y * 1.5, this.group.position.z));
  }
  dispose() { scene.remove(this.group); this.tagEl.remove(); }
}
function syncBoats(n, stepped) {
  boats = boats.filter((b) => { if (b.k > n) { b.dispose(); return false; } return true; });
  let i = 0;
  for (let k = 0; k <= n; k++) {
    const info = mergeInfo(data.commits[k]); if (!info) continue;
    if (!boats.some((b) => b.k === k)) boats.push(new Boat(k, info, i, stepped && k === n));
    i++;
  }
}

// ---------------------------------------------------------------- sound: tiny synthesised effects, no audio files
const Sound = { ctx: null, out: null, on: true };
try { Sound.on = localStorage.getItem("mossgit-sound") !== "off"; } catch {}
function unlockAudio() {
  if (!Sound.on) return;
  if (!Sound.ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; Sound.ctx = new AC();
      const comp = Sound.ctx.createDynamicsCompressor(); comp.connect(Sound.ctx.destination);
      Sound.out = Sound.ctx.createGain(); Sound.out.gain.value = 0.55; Sound.out.connect(comp);
    } catch { Sound.ctx = null; return; }
  }
  if (Sound.ctx.state === "suspended") Sound.ctx.resume();
  setupMusic();
}
addEventListener("pointerdown", unlockAudio, true);
addEventListener("keydown", unlockAudio, true);
function tone(f, { to, type = "sine", dur = 0.16, vol = 0.12, delay = 0, attack = 0.006 } = {}) {
  const c = Sound.ctx; if (!Sound.on || !c || c.state !== "running") return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(Sound.out); o.start(t); o.stop(t + dur + 0.03);
}
let noiseBuf = null;
function hiss({ dur = 0.15, vol = 0.08, freq = 1800, q = 0.8, delay = 0, to } = {}) {
  const c = Sound.ctx; if (!Sound.on || !c || c.state !== "running") return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + delay, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; bp.type = "bandpass"; bp.frequency.setValueAtTime(freq, t); if (to) bp.frequency.exponentialRampToValueAtTime(to, t + dur); bp.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(Sound.out); src.start(t); src.stop(t + dur + 0.02);
}
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const sfx = {
  sprout: (delay) => tone(PENTA[Math.floor(Math.random() * PENTA.length)], { type: "triangle", dur: 0.22, vol: 0.07, delay }),
  tend: (delay) => tone(PENTA[Math.floor(Math.random() * 4)] / 2, { dur: 0.12, vol: 0.05, delay }),
  wilt: (delay) => tone(420, { to: 210, dur: 0.35, vol: 0.045, delay }),
  chime: () => { tone(1568, { dur: 0.9, vol: 0.035 }); tone(2349, { dur: 0.7, vol: 0.02, delay: 0.02 }); },
  boing: () => { tone(260, { to: 720, type: "sine", dur: 0.14, vol: 0.14 }); tone(720, { to: 480, dur: 0.18, vol: 0.1, delay: 0.13 }); tone(1760, { dur: 0.08, vol: 0.03, delay: 0.3 }); },
  spawn: () => { tone(190, { to: 85, type: "sawtooth", dur: 0.38, vol: 0.06 }); tone(95, { to: 140, type: "square", dur: 0.18, vol: 0.03, delay: 0.32 }); hiss({ dur: 0.25, vol: 0.05, freq: 600 }); },
  chomp: () => { hiss({ dur: 0.05, vol: 0.06, freq: 2500, q: 3 }); tone(160, { to: 120, type: "square", dur: 0.05, vol: 0.025 }); },
  alert: () => { tone(880, { type: "square", dur: 0.07, vol: 0.05 }); tone(1320, { type: "square", dur: 0.09, vol: 0.05, delay: 0.08 }); },
  bonk: (n) => { tone(330 + n * 80, { to: 120, type: "square", dur: 0.11, vol: 0.09 }); hiss({ dur: 0.12, vol: 0.09, freq: 1200 + n * 300 }); tone(2000 + n * 300, { dur: 0.06, vol: 0.03, delay: 0.05 }); },
  poof: () => { hiss({ dur: 0.45, vol: 0.08, freq: 500, to: 4000 }); tone(400, { to: 1800, dur: 0.4, vol: 0.06 }); },
  toot: () => { tone(330, { type: "triangle", dur: 0.32, vol: 0.06 }); tone(165, { type: "sine", dur: 0.32, vol: 0.05 }); tone(262, { type: "triangle", dur: 0.5, vol: 0.06, delay: 0.36 }); tone(131, { type: "sine", dur: 0.5, vol: 0.05, delay: 0.36 }); },
  splash: () => { hiss({ dur: 0.5, vol: 0.05, freq: 900, to: 300 }); hiss({ dur: 0.25, vol: 0.03, freq: 3000, delay: 0.05 }); },
  thunder: () => { hiss({ dur: 2.6, vol: 0.16, freq: 140, q: 0.5 }); tone(52, { to: 38, dur: 2.2, vol: 0.12, attack: 0.05 }); hiss({ dur: 0.4, vol: 0.06, freq: 900, delay: 0.05 }); },
  victory: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { type: "triangle", dur: i === 3 ? 0.45 : 0.14, vol: 0.08, delay: 0.12 * i })),
};

// ---------------------------------------------------------------- the villain: a bug that shows up on bug-fix commits
const BUG_RE = /\b(fix(e[sd])?|bug(s|fix)?|hotfix|revert(ed)?|patch(ed)?|broken|crash(es|ed)?|regression|typo)\b/i;
const isFix = (c) => !!c && c.c.length > 0 && BUG_RE.test(c.m);
let villain = null;
const bugMat = {
  shell: new THREE.MeshStandardMaterial({ color: "#4d2b61", roughness: 0.35, metalness: 0.15 }),
  spot: new THREE.MeshStandardMaterial({ color: "#7a4596", roughness: 0.5 }),
  head: new THREE.MeshStandardMaterial({ color: "#2c1838", roughness: 0.6 }),
  eye: new THREE.MeshStandardMaterial({ color: "#ff6a52", emissive: "#ff3d2e", emissiveIntensity: 2.4 }),
  dark: new THREE.MeshStandardMaterial({ color: "#16101a", roughness: 0.7 }),
  fang: new THREE.MeshStandardMaterial({ color: "#fff6ea", roughness: 0.4 }),
};
const puffs = [];
const puffGeo = new THREE.SphereGeometry(0.5, 10, 8);
function dust(x, y, z, n = 7, color = "#f2e9d8") {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
    const a = Math.random() * Math.PI * 2;
    m.position.set(x, y, z); m.userData = { vx: Math.cos(a) * (0.6 + Math.random()), vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * (0.6 + Math.random()), life: 0.45 + Math.random() * 0.25 };
    m.userData.max = m.userData.life; m.scale.setScalar(0.08);
    scene.add(m); puffs.push(m);
  }
}
function updatePuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const m = puffs[i], u = m.userData; u.life -= dt;
    if (u.life <= 0) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); continue; }
    const k = 1 - u.life / u.max;
    m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; u.vx *= 0.9; u.vz *= 0.9;
    m.scale.setScalar(0.08 + k * 0.28); m.material.opacity = 0.85 * (1 - k);
  }
}
const STAR_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 .8 9.9 6.1 15.2 8 9.9 9.9 8 15.2 6.1 9.9.8 8 6.1 6.1z"/></svg>';
function screenOf(v) { _p.copy(v).project(camera); return { x: ((_p.x + 1) / 2) * innerWidth, y: ((1 - _p.y) / 2) * innerHeight, ok: _p.z < 1 }; }
function sparkle(v, n, color = "#ffd45e") {
  const s = screenOf(v); if (!s.ok) return;
  for (let k = 0; k < n; k++) {
    const el = document.createElement("div"); el.className = "spark"; el.innerHTML = STAR_SVG; el.style.color = color;
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 40;
    el.style.setProperty("--x", `${s.x}px`); el.style.setProperty("--y", `${s.y}px`);
    el.style.setProperty("--dx", `${Math.cos(a) * d}px`); el.style.setProperty("--dy", `${Math.sin(a) * d - 10}px`);
    el.style.setProperty("--r", `${(Math.random() - 0.5) * 300}deg`);
    el.addEventListener("animationend", () => el.remove());
    labelsEl.appendChild(el);
  }
}
const ease = { out: (x) => 1 - (1 - x) ** 3, back: (x) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2 };

class Villain {
  constructor(hero, plant, toy = false) {
    this.hero = hero; this.plant = plant; this.toy = toy; this.t = 0; this.phase = "spawn"; this.round = 0; this.hits = 0;
    const g = new THREE.Group(), body = new THREE.Group(); this.group = g; this.body = body; g.add(body);
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; body.add(m); return m; };
    this.hit = add(new THREE.SphereGeometry(0.26, 20, 14), bugMat.shell, 0, 0.21, -0.02, 1, 0.72, 1.15);
    this.hit.userData.villain = this;
    add(new THREE.SphereGeometry(0.05, 8, 6), bugMat.spot, 0.1, 0.38, -0.05, 1, 0.4, 1);
    add(new THREE.SphereGeometry(0.04, 8, 6), bugMat.spot, -0.08, 0.38, -0.14, 1, 0.4, 1);
    add(new THREE.SphereGeometry(0.06, 8, 6), bugMat.spot, -0.04, 0.37, 0.08, 1, 0.4, 1);
    add(new THREE.SphereGeometry(0.15, 14, 10), bugMat.head, 0, 0.2, 0.27);
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.048, 10, 8), bugMat.eye, 0.07 * s, 0.25, 0.385);
      add(new THREE.BoxGeometry(0.085, 0.02, 0.02), bugMat.dark, 0.07 * s, 0.312, 0.4, 1, 1, 1, 0, 0, -0.5 * s);
      add(new THREE.ConeGeometry(0.018, 0.05, 5), bugMat.fang, 0.035 * s, 0.13, 0.4, 1, 1, 1, Math.PI, 0, 0);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), bugMat.dark, 0.06 * s, 0.39, 0.33, 1, 1, 1, 0.5, 0, -0.35 * s);
      add(new THREE.SphereGeometry(0.026, 8, 6), bugMat.eye, 0.1 * s, 0.49, 0.39);
      for (const z of [-0.14, 0, 0.14]) add(new THREE.CylinderGeometry(0.012, 0.01, 0.17, 4), bugMat.dark, 0.25 * s, 0.07, z, 1, 1, 1, 0, 0, 1.0 * s);
    }
    const out = new THREE.Vector2(plant.x, plant.z); if (out.lengthSq() < 0.01) out.set(1, 0); out.normalize();
    this.pos = new THREE.Vector3(plant.x + out.x * (plant.fp + 0.4), 0, plant.z + out.y * (plant.fp + 0.4));
    this.heading = Math.atan2(plant.x - this.pos.x, plant.z - this.pos.z);
    g.scale.setScalar(0.001); scene.add(g);
    this.saved = { pos: camera.position.clone(), target: controls.target.clone() }; this.camT = 0;
    hero.scripted = true; hero.queue = []; hero.target = null;
    const hd = new THREE.Vector2(hero.pos.x - this.pos.x, hero.pos.z - this.pos.z); if (hd.lengthSq() < 0.01) hd.set(-out.x, -out.y); hd.normalize();
    this.spot = new THREE.Vector3(this.pos.x + hd.x * 0.95, 0, this.pos.z + hd.y * 0.95);
    this.alertEl = document.createElement("div"); this.alertEl.className = "alert"; this.alertEl.textContent = "!"; this.alertEl.style.visibility = "hidden";
    labelsEl.appendChild(this.alertEl);
    this.y = () => heightAt(this.pos.x, this.pos.z) - 0.02;
    dust(this.pos.x, this.y() + 0.1, this.pos.z, 8, "#cdb99a"); sfx.spawn();
    setBattle(`A bug crawled into ${data.files[plant.i].split("/").pop()}!`);
  }
  bonk() { // the viewer helps
    if (this.phase === "defeat" || this.phase === "done") return;
    this.hits++; sfx.bonk(2 + this.hits);
    const v = _v.set(this.pos.x, this.y() + 0.35, this.pos.z); sparkle(v, 5); dust(v.x, v.y, v.z, 4);
    this.body.scale.set(1.25, 0.7, 1.25);
    if (this.hits >= 2 || this.phase === "clash") this.go("defeat");
  }
  go(phase) { this.phase = phase; this.t = 0; }
  update(dt, t) {
    this.t += dt;
    const h = this.hero, P = this.plant, y = this.y();
    this.body.scale.lerp(_s.set(1, 1, 1), Math.min(1, dt * 10));
    if (this.phase === "spawn") {
      const k = Math.min(1, this.t / 0.8); this.group.scale.setScalar(Math.max(0.001, ease.back(k)));
      if (k >= 1) { this.go("nibble"); this.alertEl.style.visibility = "visible"; sfx.alert(); }
    } else if (this.phase === "nibble") {
      P.nibbling = true; P.shake = 1;
      this.body.position.z = Math.max(0, Math.sin(this.t * 11)) * 0.06;
      if ((this.chompT = (this.chompT || 0) - dt) < 0) { this.chompT = 0.36; sfx.chomp(); }
      const dx = this.spot.x - h.pos.x, dz = this.spot.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.04 && this.t > 0.6) {
        const step = Math.min(d, 3.6 * dt); h.pos.x += (dx / d) * step; h.pos.z += (dz / d) * step; h.hop += step * 7.5;
        h.heading = Math.atan2(dx, dz); h.body.position.y = Math.abs(Math.sin(h.hop)) * 0.26;
      } else if (d <= 0.04) { h.body.position.y = 0; this.go("face"); setBattle(`${h.tagEl.textContent} to the rescue…`); }
    } else if (this.phase === "face") {
      P.nibbling = true;
      this.body.position.z = 0;
      const want = Math.atan2(h.pos.x - this.pos.x, h.pos.z - this.pos.z);
      this.heading += ((((want - this.heading + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
      h.heading = Math.atan2(this.pos.x - h.pos.x, this.pos.z - h.pos.z);
      const bob = Math.abs(Math.sin(this.t * 9)) * 0.1; this.body.position.y = bob; h.body.position.y = bob;
      if (this.t > 1.2) { this.alertEl.style.visibility = "hidden"; this.go("clash"); this.base = { bx: this.pos.x, bz: this.pos.z, hx: h.pos.x, hz: h.pos.z }; }
    } else if (this.phase === "clash") {
      P.nibbling = true;
      const b = this.base, u = this.t, ax = (b.bx - b.hx) / 0.95, az = (b.bz - b.hz) / 0.95;
      let off;
      if (u < 0.32) off = ease.out(u / 0.32) * 0.3;
      else { if (!this.hitThisRound) { this.hitThisRound = true; this.contact(); } off = 0.3 * Math.max(0, 1 - (u - 0.32) / 0.45); }
      h.pos.x = b.hx + ax * off; h.pos.z = b.hz + az * off; this.pos.x = b.bx - ax * off; this.pos.z = b.bz - az * off;
      h.body.position.y = u > 0.32 ? Math.sin(Math.min(1, (u - 0.32) / 0.5) * Math.PI) * 0.2 : 0;
      this.body.position.y = u > 0.32 ? Math.sin(Math.min(1, (u - 0.32) / 0.5) * Math.PI) * 0.14 : 0;
      if (u > 0.95) { this.round++; this.hitThisRound = false; if (this.round >= 3) this.go("defeat"); else this.t = 0; }
    } else if (this.phase === "defeat") {
      if (!this.launched) {
        this.launched = true; P.nibbling = false; sfx.victory(); h.pet();
        setBattle(`${h.tagEl.textContent} squashed the bug.`); this.alertEl.remove();
        this.fly = { x: this.pos.x - h.pos.x, z: this.pos.z - h.pos.z }; const l = Math.hypot(this.fly.x, this.fly.z) || 1; this.fly.x /= l; this.fly.z /= l;
      }
      const u = this.t / 1.5;
      this.pos.x += this.fly.x * dt * 2.3; this.pos.z += this.fly.z * dt * 2.3;
      this.body.position.y = u * 4 - u * u * 2.5; this.group.rotation.z = u * 9; this.group.scale.setScalar(Math.max(0.001, 1 - Math.max(0, u - 0.55) * 2.6));
      if (u > 0.85 && !this.poofed) {
        this.poofed = true; sfx.poof();
        const v = _v.set(this.pos.x, y + this.body.position.y + 0.2, this.pos.z);
        dust(v.x, v.y, v.z, 9, "#c9a3dd"); sparkle(v, 8, "#d9b8ef"); burst(v.x, v.y, v.z, 10);
        P.pulse = 1; burst(P.x, P.y + P.S * 0.7, P.z, 6);
      }
      if (u > 1.2) this.go("done");
    }
    if (this.phase === "done") return this.finish();
    this.group.position.set(this.pos.x, y, this.pos.z);
    this.group.rotation.y = this.heading;
    if (this.alertEl.isConnected) {
      const s = screenOf(_v.set(h.group.position.x, h.group.position.y + 0.95, h.group.position.z));
      this.alertEl.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
  }
  contact() {
    const h = this.hero, mx = (h.pos.x + this.pos.x) / 2, mz = (h.pos.z + this.pos.z) / 2, my = heightAt(mx, mz) + 0.3;
    sfx.bonk(this.round); dust(mx, my, mz, 6); sparkle(_v.set(mx, my + 0.1, mz), 4 + this.round);
    this.body.scale.set(1.3, 0.65, 1.3); h.body.scale.set(1.2, 0.75, 1.2);
  }
  finish() {
    if (window.gsap && !following && clock.elapsedTime - lastInteract > 0.5) {
      const { pos, target } = this.saved, o = { duration: 1.4, delay: 0.5, ease: "power2.inOut" };
      window.gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, ...o });
      window.gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, ...o });
    }
    this.plant.nibbling = false; this.hero.scripted = false; this.hero.home.copy(this.hero.pos); this.hero.body.position.y = 0;
    this.dispose(); villain = null;
  }
  dispose() {
    scene.remove(this.group); this.alertEl.remove(); this.plant.nibbling = false;
    this.group.traverse((o) => o.geometry?.dispose());
    this.hero.scripted = false;
  }
}
function setBattle(text) { const el = $("cBattle"); el.textContent = text; el.hidden = !text; }
function cancelFight() { if (villain) { villain.dispose(); villain = null; } }
function startFight(hero, plant, toy = false) {
  cancelFight();
  if (!hero || !plant || reduceMotion) return;
  villain = new Villain(hero, plant, toy);
}
function releaseBug() {
  const alive = plants.filter((p) => p.alive && p.g > 0.5);
  if (!alive.length || !creatures.length || villain) { lantern.flare = 1; sfx.chime(); return; }
  pause();
  const hero = following || creatures[Math.floor(Math.random() * creatures.length)];
  alive.sort((a, b) => Math.hypot(a.x - hero.pos.x, a.z - hero.pos.z) - Math.hypot(b.x - hero.pos.x, b.z - hero.pos.z));
  lantern.flare = 1;
  startFight(hero, alive[Math.floor(Math.random() * Math.min(6, alive.length))], true);
}
const soundBtn = $("soundBtn");
function paintSound() {
  soundBtn.setAttribute("aria-pressed", String(Sound.on));
  soundBtn.querySelector("span").textContent = Sound.on ? "Sound on" : "Sound off";
  soundBtn.querySelector(".wave").style.display = Sound.on ? "" : "none";
  soundBtn.querySelector(".mute").style.display = Sound.on ? "none" : "";
}
soundBtn.addEventListener("click", () => {
  Sound.on = !Sound.on;
  try { localStorage.setItem("mossgit-sound", Sound.on ? "on" : "off"); } catch {}
  if (Sound.on) { unlockAudio(); setTimeout(() => sfx.boing(), 60); }
  paintSound();
});
paintSound();

// ---------------------------------------------------------------- music: a cozy loop, and a slow serious theme for fights
const Music = { on: true, bus: null, cozy: null, fight: null, lp: null, next: 0, step: 0, mode: "cozy" };
try { Music.on = localStorage.getItem("mossgit-music") !== "off"; } catch {}
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
function setupMusic() {
  const c = Sound.ctx; if (!c || Music.bus) return;
  const len = Math.floor(c.sampleRate * 2.8), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const verb = c.createConvolver(); verb.buffer = ir;
  const bus = c.createGain(); bus.gain.value = Music.on ? 0.9 : 0;
  const dry = c.createGain(); dry.gain.value = 0.7; const wet = c.createGain(); wet.gain.value = 0.6;
  bus.connect(dry).connect(Sound.out); bus.connect(verb).connect(wet).connect(Sound.out);
  Music.lp = c.createBiquadFilter(); Music.lp.type = "lowpass"; Music.lp.frequency.value = 2600;
  Music.cozy = c.createGain(); Music.cozy.gain.value = 1; Music.lp.connect(Music.cozy).connect(bus);
  Music.fight = c.createGain(); Music.fight.gain.value = 0; Music.fight.connect(bus);
  Music.bus = bus; Music.next = c.currentTime + 0.3;
  setInterval(scheduleMusic, 110);
}
function voice(dest, f, t, { type = "triangle", dur = 1, vol = 0.05, attack = 0.01, detune = 0, filter = 0, q = 0.7, to = 0 } = {}) {
  const c = Sound.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6); o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = o; if (filter) { const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = filter; lp.Q.value = q; o.connect(lp); n = lp; }
  n.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return { o, g };
}
function brush(dest, t, vol = 0.012, freq = 6500, dur = 0.09) {
  const c = Sound.ctx;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.9;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
}
// Fmaj7 Em7 Dm7 Cmaj7 by day, Am7 Fmaj7 Cmaj7 G6 at night
const DAY = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const NIGHT = [[45, 48, 52, 55], [41, 45, 48, 52], [48, 52, 55, 59], [43, 47, 50, 52]];
const BELLS = [72, 74, 76, 79, 81, 84];
function cozyBeat(t, step, beat) {
  const dest = Music.lp, bar = Math.floor(step / 4) % 4, b = step % 4, chord = (night > 0.55 ? NIGHT : DAY)[bar];
  if (b === 0) {
    for (const n of chord) {
      voice(dest, midi(n), t, { type: "triangle", dur: beat * 4.3, vol: 0.016, attack: 1.1, filter: 1300 });
      voice(dest, midi(n), t, { type: "sine", dur: beat * 4.3, vol: 0.011, attack: 1.4, detune: 7 });
    }
    voice(dest, midi(chord[0] - 12), t, { type: "sine", dur: beat * 1.9, vol: 0.075, attack: 0.03 });
  }
  if (b === 2) voice(dest, midi(chord[0] - 5), t, { type: "sine", dur: beat * 1.5, vol: 0.045, attack: 0.03 });
  if (Math.random() < 0.55) {
    const pool = Math.random() < 0.5 ? chord.map((n) => n + 12) : BELLS;
    const n = pool[Math.floor(Math.random() * pool.length)], at = t + (Math.random() < 0.3 ? beat / 2 : 0);
    voice(dest, midi(n), at, { type: "sine", dur: 1.8, vol: 0.032, attack: 0.004 });
    voice(dest, midi(n + 12), at, { type: "sine", dur: 0.5, vol: 0.008, attack: 0.002 });
  }
  if (b === 1 || b === 3) brush(dest, t, 0.01);
  if (Math.random() < 0.25) brush(dest, t + beat / 2, 0.005);
  if (night > 0.6 && Math.random() < 0.35) for (let k = 0; k < 3; k++) voice(dest, 4400, t + 0.3 + k * 0.07, { type: "sine", dur: 0.035, vol: 0.006, attack: 0.004 });
}
// D minor: low drone, timpani, a slow string ostinato that leans on C# for tension
const OSTINATO = [50, 53, 52, 49, 50, 53, 55, 52];
function fightBeat(t, step, beat) {
  const dest = Music.fight, b = step % 8;
  if (b === 0) {
    voice(dest, midi(38), t, { type: "sawtooth", dur: beat * 8.3, vol: 0.03, attack: 2.2, filter: 360 });
    voice(dest, midi(45), t, { type: "sawtooth", dur: beat * 8.3, vol: 0.022, attack: 2.6, filter: 420, detune: -6 });
    const trem = voice(dest, midi(69), t, { type: "sine", dur: beat * 8, vol: 0.01, attack: 3 });
    const lfo = Sound.ctx.createOscillator(), lg = Sound.ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = 0.008;
    lfo.connect(lg).connect(trem.g.gain); lfo.start(t); lfo.stop(t + beat * 8);
  }
  if (b === 0 || b === 4) timpani(dest, t, 0.22);
  if (b === 6) timpani(dest, t + beat / 2, 0.14);
  const n = OSTINATO[b];
  voice(dest, midi(n), t, { type: "sawtooth", dur: beat * 0.95, vol: 0.032, attack: 0.05, filter: 680, q: 1.2 });
  voice(dest, midi(n - 12), t, { type: "sawtooth", dur: beat * 0.95, vol: 0.02, attack: 0.05, filter: 420 });
  if (b === 4) {
    voice(dest, midi(46), t, { type: "sawtooth", dur: beat * 2, vol: 0.026, attack: 0.7, filter: 900 });
    voice(dest, midi(45), t + beat * 2, { type: "sawtooth", dur: beat * 2, vol: 0.026, attack: 0.5, filter: 900 });
    voice(dest, midi(53), t, { type: "sawtooth", dur: beat * 4, vol: 0.014, attack: 0.9, filter: 1000 });
  }
}
function timpani(dest, t, vol) {
  voice(dest, 92, t, { type: "sine", dur: 1.3, vol, attack: 0.005, to: 44 });
  brush(dest, t, vol * 0.25, 180, 0.25);
}
function scheduleMusic() {
  const c = Sound.ctx; if (!c) return;
  if (!Sound.on || c.state !== "running" || document.hidden) { Music.next = c.currentTime + 0.25; return; }
  const want = villain && villain.phase !== "defeat" && villain.phase !== "done" ? "fight" : "cozy";
  if (want !== Music.mode) {
    Music.mode = want; Music.step = 0; Music.next = c.currentTime + 0.15;
    Music.cozy.gain.setTargetAtTime(want === "cozy" ? 1 : 0, c.currentTime, 0.7);
    Music.fight.gain.setTargetAtTime(want === "fight" ? 1 : 0, c.currentTime, want === "fight" ? 0.5 : 1.2);
  }
  Music.lp.frequency.setTargetAtTime(2600 - night * 1500, c.currentTime, 1);
  const beat = 60 / (Music.mode === "fight" ? 54 : 66);
  while (Music.next < c.currentTime + 0.4) {
    (Music.mode === "fight" ? fightBeat : cozyBeat)(Music.next, Music.step, beat);
    Music.next += beat; Music.step++;
  }
}
const musicBtn = $("musicBtn");
function paintMusic() {
  musicBtn.setAttribute("aria-pressed", String(Music.on));
  musicBtn.querySelector("span").textContent = Music.on ? "Music on" : "Music off";
  musicBtn.querySelector(".slash").style.display = Music.on ? "none" : "";
}
musicBtn.addEventListener("click", () => {
  Music.on = !Music.on;
  try { localStorage.setItem("mossgit-music", Music.on ? "on" : "off"); } catch {}
  unlockAudio();
  if (Music.bus) Music.bus.gain.setTargetAtTime(Music.on ? 0.9 : 0, Sound.ctx.currentTime, 0.4);
  paintMusic();
});
paintMusic();

// ---------------------------------------------------------------- weather: driven by the repo, or picked by hand
const PRESETS = {
  clear: { cover: 0.12, rain: 0, snow: 0, mist: 0, wind: 0.15, storm: 0 },
  rain: { cover: 0.85, rain: 0.75, snow: 0, mist: 0.15, wind: 0.45, storm: 0 },
  storm: { cover: 1, rain: 1, snow: 0, mist: 0.2, wind: 0.95, storm: 1 },
  snow: { cover: 0.75, rain: 0, snow: 0.85, mist: 0.25, wind: 0.25, storm: 0 },
  mist: { cover: 0.35, rain: 0, snow: 0, mist: 0.9, wind: 0.05, storm: 0 },
};
function autoWeather(n) {
  if (!data || n < 0) return ["clear", PRESETS.clear];
  const c = data.commits[n], local = new Date((c.t + (c.o || 0) * 60) * 1000), month = local.getUTCMonth(), h = localHour(c);
  const churn = c.c.reduce((s, x) => s + x[1] + x[2], 0);
  const burst = data.commits.filter((x) => x.t <= c.t && x.t > c.t - 3 * 3600).length;
  let name = "clear", w = { ...PRESETS.clear };
  if (month === 11 || month <= 1) { name = "snow"; w = { ...PRESETS.snow }; }
  else if (churn >= wx.churnTop) { name = "rain"; w = { ...PRESETS.rain }; }
  else if (h >= 5 && h < 8) { name = "mist"; w = { ...PRESETS.mist }; }
  else w.cover = 0.12 + Math.min(0.4, burst * 0.06);
  w.wind = Math.max(w.wind, Math.min(1, burst / 6));
  if (w.wind > 0.6 && name === "clear") name = "windy";
  return [name, w];
}
function pickWeather() {
  let name, w;
  if (villain && villain.phase !== "defeat" && villain.phase !== "done") { name = "storm"; w = PRESETS.storm; }
  else if (wx.mode !== "auto") { name = wx.mode; w = PRESETS[wx.mode]; }
  else [name, w] = autoWeather(idx);
  wx.want = { ...w }; wx.label = name;
}
// clouds
const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, flatShading: true, transparent: true, opacity: 0.96 });
const cloudGeo = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.22, 9);
const clouds = [];
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group(), n = 3 + (i % 3);
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(cloudGeo, cloudMat), s = 0.9 + Math.random() * 1.1;
    m.position.set((k - n / 2) * 1.3 + Math.random() * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 1.2);
    m.scale.set(s * 1.2, s * 0.8, s); m.castShadow = true; g.add(m);
  }
  g.userData = { ang: (i / 14) * Math.PI * 2 + Math.random(), rad: 4 + Math.random() * 15, h: 12.5 + Math.random() * 3, thr: i / 14, sp: 0.6 + Math.random() * 0.8 };
  g.scale.setScalar(0.001); scene.add(g); clouds.push(g);
}
// rain
const RAIN_N = 1800, rainPos = new Float32Array(RAIN_N * 6), rainSeed = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 26; rainSeed.set([Math.cos(a) * r, Math.random() * 16, Math.sin(a) * r], i * 3); }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#d4e4f0", transparent: true, opacity: 0.55, depthWrite: false }));
rainLines.frustumCulled = false; scene.add(rainLines);
// snow
const SNOW_N = 1400, snowPos = new Float32Array(SNOW_N * 3), snowSeed = new Float32Array(SNOW_N * 4);
for (let i = 0; i < SNOW_N; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 24; snowSeed.set([Math.cos(a) * r, Math.random() * 14, Math.sin(a) * r, Math.random() * 6.28], i * 4); }
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.2, transparent: true, opacity: 0.95, depthWrite: false }));
snowPts.frustumCulled = false; scene.add(snowPts);
const GREY = col("#7d868c"), MISTC = col("#c9cbc6");

function updateWeather(dt, t) {
  pickWeather();
  let moving = false;
  for (const k of WX_KEYS) {
    const d = wx.want[k] - wx.cur[k];
    if (Math.abs(d) > 0.002) { wx.cur[k] += d * Math.min(1, dt * (k === "storm" ? 1.2 : 0.55)); moving = true; }
  }
  if (moving) skyDirty = true;
  const W = wx.cur;
  // clouds
  for (const g of clouds) {
    const u = g.userData; u.ang += dt * 0.012 * u.sp * (1 + W.wind * 3);
    const s = smoothstep(u.thr - 0.05, u.thr + 0.12, W.cover) * (0.6 + W.storm * 0.15);
    g.scale.setScalar(Math.max(0.001, s)); g.visible = s > 0.01;
    g.position.set(Math.cos(u.ang) * u.rad, u.h - W.storm * 2, Math.sin(u.ang) * u.rad);
    g.rotation.y = -u.ang;
  }
  cloudMat.color.set("#ffffff").lerp(_sa.set("#5d646c"), Math.min(1, W.rain * 0.5 + W.storm * 0.5));
  // rain
  const nr = Math.floor(W.rain * RAIN_N), slant = 0.15 + W.wind * 0.6;
  for (let i = 0; i < nr; i++) {
    const o = i * 3; let y = rainSeed[o + 1] - dt * (15 + W.storm * 6); if (y < -0.5) y += 16; rainSeed[o + 1] = y;
    const x = rainSeed[o] + (16 - y) * slant * 0.08, z = rainSeed[o + 2];
    rainPos.set([x, y, z, x + slant * 0.35, y + 0.55, z], i * 6);
  }
  rainGeo.setDrawRange(0, nr * 2); rainGeo.attributes.position.needsUpdate = true; rainLines.visible = nr > 0;
  // snow
  const ns = Math.floor(W.snow * SNOW_N);
  for (let i = 0; i < ns; i++) {
    const o = i * 4; let y = snowSeed[o + 1] - dt * (0.9 + W.wind * 0.6); if (y < 0) y += 14; snowSeed[o + 1] = y;
    snowPos.set([snowSeed[o] + Math.sin(t * 0.7 + snowSeed[o + 3]) * 0.4 + (14 - y) * W.wind * 0.15, y, snowSeed[o + 2] + Math.cos(t * 0.6 + snowSeed[o + 3]) * 0.4], i * 3);
  }
  snowGeo.setDrawRange(0, ns); snowGeo.attributes.position.needsUpdate = true; snowPts.visible = ns > 0;
  // lightning
  wx.flash = Math.max(0, wx.flash - dt * 3.5);
  if (W.storm > 0.6 && (wx.nextBolt -= dt) < 0) { wx.flash = 1; wx.nextBolt = 2.5 + Math.random() * 5; setTimeout(() => sfx.thunder(), 250 + Math.random() * 600); }
  // light under the weather
  sun.intensity = skyBase.sun * (1 - 0.7 * W.cover * (1 - 0.3 * night)) ;
  hemi.intensity = skyBase.hemi * (1 - 0.25 * W.cover) + wx.flash * 2.2;
  renderer.toneMappingExposure = skyBase.exposure * (1 - 0.12 * W.cover) + wx.flash * 0.7;
  scene.fog.color.copy(skyBase.fog).lerp(GREY, W.cover * 0.35 + W.rain * 0.2).lerp(MISTC, W.mist * 0.5 * (1 - night));
  scene.fog.near = 58 - W.mist * 44 - W.rain * 18; scene.fog.far = 125 - W.mist * 70 - W.rain * 35;
  waveAmp.value = 0.8 + W.wind * 1.1 + W.storm * 0.4;
  const frost = W.snow * (1 - night * 0.6);
  if (terrain) { terrain.material.emissive.set("#e9eef5"); terrain.material.emissiveIntensity = frost * 0.32; }
  MAT.plant.emissive.set("#e9eef5"); MAT.plant.emissiveIntensity = frost * 0.14;
  Sound.wxGains?.(W);
}
// rain and wind you can hear
let rainNode = null;
Sound.wxGains = (W) => {
  const c = Sound.ctx; if (!c || c.state !== "running") return;
  if (!rainNode) {
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(Sound.out); s.start(); return g; };
    rainNode = { rain: mk("lowpass", 1500, 0.4), wind: mk("bandpass", 380, 0.6) };
  }
  const on = Sound.on ? 1 : 0;
  rainNode.rain.gain.setTargetAtTime(on * W.rain * 0.07, c.currentTime, 0.5);
  rainNode.wind.gain.setTargetAtTime(on * Math.max(0, W.wind - 0.25) * 0.05 * (0.8 + 0.2 * Math.sin(c.currentTime * 0.7)), c.currentTime, 0.6);
};
const weatherBtn = $("weatherBtn"), WX_CYCLE = ["auto", "clear", "rain", "storm", "snow", "mist"];
function paintWeather() { weatherBtn.querySelector("span").textContent = wx.mode === "auto" ? `Weather: auto` : `Weather: ${wx.mode}`; }
weatherBtn.addEventListener("click", () => { wx.mode = WX_CYCLE[(WX_CYCLE.indexOf(wx.mode) + 1) % WX_CYCLE.length]; paintWeather(); updateUI(); });
paintWeather();

// ---------------------------------------------------------------- plant your own repo: read a git log in the browser
const GIT_CMD = 'git log --reverse --no-renames --raw --numstat --format="%x1e%H%x1f%at%x1f%an%x1f%ae%x1f%ai%x1f%s" --output=garden.txt';
function parseGitLog(text, name) {
  text = text.replace(/^﻿/, "");
  if (text.trimStart().startsWith("{")) {
    const d = JSON.parse(text);
    if (!Array.isArray(d.files) || !Array.isArray(d.commits) || !Array.isArray(d.authors)) throw new Error("That JSON file isn't a Mossgit garden.");
    d.name = d.name || name; return d;
  }
  const blocks = text.split("\x1e").slice(1);
  if (!blocks.length) throw new Error("No commits found in that file. Run the command inside a git repository, then drop the garden.txt it makes.");
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
  const union = (a, b) => { for (const k of [a, b]) if (!parent.has(k)) parent.set(k, k); parent.set(find(a), find(b)); };
  const nameKey = (n) => "n:" + n.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d+$/, "");
  const emailKey = (e) => "e:" + e.toLowerCase().replace(/^\d+\+/, "");
  const raw = [];
  for (const block of blocks) {
    const [head, ...lines] = block.split(/\r?\n/);
    const [hash, at, an = "", ae = "", ai = "", ...rest] = head.split("\x1f");
    const subject = rest.join("\x1f");
    union(nameKey(an), emailKey(ae));
    const tz = ai.match(/([+-])(\d\d)(\d\d)$/);
    const status = new Map(), stats = [];
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith(":")) { const [meta, path] = line.split("\t"); status.set(path, meta.split(" ").pop()[0]); }
      else { const [a, d, path] = line.split("\t"); if (path) stats.push({ path, a: a === "-" ? null : +a, d: d === "-" ? null : +d }); }
    }
    raw.push({ hash, at: +at, offset: tz ? (tz[1] === "-" ? -1 : 1) * (+tz[2] * 60 + +tz[3]) : 0, an, subject, stats, status });
  }
  const authors = [], index = new Map(), counts = new Map();
  for (const c of raw) { const r = find(nameKey(c.an)); if (!counts.has(r)) counts.set(r, new Map()); const m = counts.get(r); m.set(c.an, (m.get(c.an) || 0) + 1); }
  for (const c of raw) {
    const r = find(nameKey(c.an));
    if (!index.has(r)) { const best = [...counts.get(r)].sort((x, y) => y[1] - x[1])[0][0]; index.set(r, authors.length); authors.push({ name: best, bot: /\[bot\]$|^github-actions/i.test(best), commits: 0 }); }
    c.author = index.get(r); authors[c.author].commits++;
  }
  const files = [], fileIndex = new Map();
  const commits = raw.map((c) => {
    const ch = [];
    for (const st of c.stats) {
      if (!fileIndex.has(st.path)) { if (files.length >= 700) continue; fileIndex.set(st.path, files.length); files.push(st.path); }
      const s = c.status.get(st.path) || "M", kind = s === "D" ? "d" : s === "A" ? "a" : "m";
      ch.push([fileIndex.get(st.path), st.a ?? 0, st.d ?? 0, st.a === null ? kind + "b" : kind]);
    }
    return { h: (c.hash || "").slice(0, 7), t: c.at, o: c.offset, a: c.author, m: c.subject.slice(0, 90), c: ch };
  });
  return { name, authors, files, commits };
}
function plantStory() {
  return `<p class="k">Your own garden</p><h2>Plant your repo</h2>
    <p class="note">Two steps. The file stays in your browser; nothing is uploaded.</p>
    <h3>1 · In a terminal, inside your repo, run</h3>
    <pre class="cmd"><code>${esc(GIT_CMD)}</code></pre>
    <button class="jump" type="button" data-copy>Copy command</button>
    <h3>2 · Then drop garden.txt anywhere on this page</h3>
    <label class="field" for="plantName">Name your garden</label>
    <input class="field-input" id="plantName" type="text" value="my-repo" maxlength="40" autocomplete="off" spellcheck="false">
    <label class="jump file" for="plantFile">Choose garden.txt</label>
    <input id="plantFile" type="file" accept=".txt,.json,text/plain,application/json" hidden>
    <p class="note err" id="plantErr" hidden></p>
    <p class="note small">Works on Windows, macOS and Linux, wherever git is installed.</p>`;
}
function openPlant() {
  if (story.f >= 0 && plants.byFile[story.f]) plants.byFile[story.f].selected = false;
  if (story.kind === "gardener") { following = null; followChip.hidden = true; }
  story.kind = "plant"; story.f = -1; story.c = null;
  storyEl.hidden = false; if (!guidePanel.hidden) { guidePanel.hidden = true; guideBtn.setAttribute("aria-expanded", "false"); }
  storyBody.innerHTML = plantStory(); storyBody.scrollTop = 0;
}
async function plantFrom(file) {
  if (!file) return;
  const err = $("plantErr");
  try {
    const typed = $("plantName")?.value.trim();
    const base = file.name.replace(/\.(txt|json)$/i, "");
    const name = typed && typed !== "my-repo" ? typed : base && base !== "garden" ? base : typed || "my-repo";
    const d = parseGitLog(await file.text(), name.slice(0, 40));
    closeStory();
    await loadRepo(null, d);
  } catch (e) {
    if (err) { err.textContent = e.message || "That file couldn't be read."; err.hidden = false; }
    else { openPlant(); const e2 = $("plantErr"); e2.textContent = e.message; e2.hidden = false; }
  }
}
storyBody.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  try { await navigator.clipboard.writeText(GIT_CMD); b.textContent = "Copied"; }
  catch { const code = storyBody.querySelector(".cmd code"); const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = "Selected, press Ctrl+C"; }
  setTimeout(() => { if (b.isConnected) b.textContent = "Copy command"; }, 2200);
});
storyBody.addEventListener("change", (e) => { if (e.target.id === "plantFile") plantFrom(e.target.files[0]); });
addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); document.body.classList.add("dropping"); } });
addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("dropping"); });
addEventListener("drop", (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); document.body.classList.remove("dropping"); plantFrom(e.dataTransfer.files[0]); });
{
  const b = document.createElement("button"); b.type = "button"; b.className = "plant"; b.textContent = "+ your repo";
  b.addEventListener("click", openPlant); picker.appendChild(b);
}

// ---------------------------------------------------------------- loop
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (villain) villain.update(dt, t);
  waterTime.value = t;
  if (data) for (const b of boats) b.update(dt, t);
  updatePuffs(dt);
  if (playing && data && !villain) {
    stepTimer += dt;
    if (stepTimer >= stepInterval) { stepTimer = 0; if (idx < data.commits.length - 1) goTo(idx + 1, true); else pause(); }
  }
  controls.autoRotate = !reduceMotion && started && !playing && !following && !story.kind && t - lastInteract > 6;
  if (villain && villain.phase !== "spawn" && clock.elapsedTime - lastInteract > 0.5) {
    villain.camT += dt;
    const h = villain.hero, mid = _ft.set((h.pos.x + villain.pos.x) / 2, heightAt(villain.pos.x, villain.pos.z) + 0.3, (h.pos.z + villain.pos.z) / 2);
    const delta = mid.sub(controls.target).multiplyScalar(Math.min(1, dt * 2.2));
    controls.target.add(delta); camera.position.add(delta);
    const off = _fo.copy(camera.position).sub(controls.target), len = off.length();
    camera.position.copy(controls.target).add(off.setLength(len + (8.5 - len) * Math.min(1, dt * 1.6)));
  } else if (following) {
    const c = following, tgt = _ft.set(c.group.position.x, c.group.position.y + 0.4, c.group.position.z);
    const delta = tgt.sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(delta); camera.position.add(delta);
    if (t - followT0 < 1.6) { const off = _fo.copy(camera.position).sub(controls.target), len = off.length(); camera.position.copy(controls.target).add(off.setLength(len + (13 - len) * Math.min(1, dt * 2.5))); }
  }
  controls.update();
  const camDist = camera.position.distanceTo(controls.target), blur = 2.6 * clamp((camDist - 9) / 22, 0.3, 1);
  tiltH.uniforms.amount.value = tiltV.uniforms.amount.value = blur;
  updateWeather(dt, t);
  updateSky(dt);
  if (heatMode && state?.hot.length && (heatTick += dt) > 0.45) { heatTick = 0; for (const f of state.hot) { const p = plants.byFile[f]; if (p) burst(p.x, p.y + p.S * 0.9, p.z, 1); } }
  if (data) { updatePlants(dt, t); for (const c of creatures) c.update(dt, t); updateLabels(); }
  updateFireflies(dt, t);
  lantern.flare = Math.max(0, lantern.flare - dt * 1.6);
  lantern.light.intensity = 4 + night * 7 + Math.sin(t * 5) * 0.3 + lantern.flare * 14;
  bloom.strength = 0.5 + night * 0.3;
  lantern.core.material.emissiveIntensity = 2.2 + lantern.flare * 4;
  foamMat.uniforms.time.value = t; grain.uniforms.time.value = t;
  if (pointer) showTag(pick());
  else if (hovered) showTag(null);
  composer.render();
}

const finalPos = () => (innerWidth / innerHeight < 0.8 ? new THREE.Vector3(26, 27, 31) : new THREE.Vector3(21, 15.5, 23));
const initial = location.hash.slice(1);
loadRepo(REPOS.some((r) => r.id === initial) ? initial : REPOS[0].id).then(() => {
  const end = finalPos();
  if (reduceMotion || !window.gsap) {
    camera.position.copy(end); started = true; if (!reduceMotion) setTimeout(play, 400);
  } else {
    camera.position.set(0.01, 78, 0.6); controls.enabled = false;
    window.gsap.to(camera.position, {
      x: end.x, y: end.y, z: end.z, duration: 3.8, ease: "power3.inOut",
      onUpdate: () => camera.lookAt(controls.target),
      onComplete: () => { controls.enabled = true; started = true; play(); },
    });
  }
  renderer.setAnimationLoop(frame);
}).catch((err) => {
  document.body.insertAdjacentHTML("beforeend", `<p class="notice">${esc(err.message)}</p>`);
});
