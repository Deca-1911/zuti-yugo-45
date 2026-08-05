// ŽUTI YUGO 45 — Mala Avantura
// 3D low-poly igrica za dijete od 5 godina. Sve proceduralno, bez vanjskih resursa.
import * as THREE from './three.module.js';

// ---------------------------------------------------------------- osnove
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe8ff, 200, 900);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 2000);

const sunLight = new THREE.DirectionalLight(0xfff3d6, 2.0);
sunLight.position.set(300, 400, -200);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0xbfd9ff, 1.1));

// nebo — gradient kupola (ShaderMaterial ne koristi fog)
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color(0x3f8fe8) },
    bottom: { value: new THREE.Color(0xcfe8ff) }
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(normalize(vP).y, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.75)), 1.0); }'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 24, 12), skyMat);
scene.add(sky);

// sunce
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(45, 20),
  new THREE.MeshBasicMaterial({ color: 0xfff7b0, fog: false })
);
sunDisc.position.set(420, 380, -720);
sunDisc.lookAt(0, 0, 0);
scene.add(sunDisc);

// ---------------------------------------------------------------- pomoćnici
const rngState = { s: 1234567 };
function rng() { // deterministički pseudo-random za stabilan raspored mape
  rngState.s = (rngState.s * 1664525 + 1013904223) >>> 0;
  return rngState.s / 4294967296;
}
function mergeGeos(geos) {
  const pos = [], norm = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    norm.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return out;
}
const MAT = {}; // dijeljeni materijali
function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!MAT[key]) MAT[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
  return MAT[key];
}
function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  (parent || scene).add(m);
  return m;
}
const shadowGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
function addShadow(parent, sx, sz, y) {
  const s = new THREE.Mesh(shadowGeo, shadowMat);
  s.scale.set(sx, 1, sz);
  s.position.y = y === undefined ? 0.06 : y;
  parent.add(s);
  return s;
}

// statične prepreke (meko izguravanje — dijete ne može zapeti)
const colliders = []; // {x, z, r}
function addCollider(x, z, r) { colliders.push({ x, z, r }); }

// ---------------------------------------------------------------- teren
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), mat(0x7ec850));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// rijeka (traka duž x-osi, z ∈ [-25, 25])
const river = new THREE.Mesh(new THREE.PlaneGeometry(1100, 50), mat(0x3f7fd6));
river.rotation.x = -Math.PI / 2;
river.position.set(0, 0.04, 0);
scene.add(river);

// visina terena: most |x|<9, deck |z|<=30 na h=6, rampe 30..60
function terrainHeight(x, z) {
  if (Math.abs(x) < 9) {
    const az = Math.abs(z);
    if (az <= 30) return 6;
    if (az <= 60) return 6 * (60 - az) / 30;
  }
  return 0;
}

// ---------------------------------------------------------------- ceste
const roadMat = mat(0x555a60);
const roads = []; // {x1,z1,x2,z2,w} za "jesam li na cesti" provjere
function road(cx, cz, w, len, alongZ) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(alongZ ? w : len, alongZ ? len : w), roadMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0.08, cz);
  scene.add(m);
  roads.push(alongZ
    ? { x1: cx - w / 2, x2: cx + w / 2, z1: cz - len / 2, z2: cz + len / 2 }
    : { x1: cx - len / 2, x2: cx + len / 2, z1: cz - w / 2, z2: cz + w / 2 });
}
function onRoad(x, z) {
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    if (x >= r.x1 - 3 && x <= r.x2 + 3 && z >= r.z1 - 3 && z <= r.z2 + 3) return true;
  }
  return false;
}
// glavna N-S (preko mosta), prekinuta na rijeci — most je zaseban
road(0, 230, 12, 340, true);   // jug: z 60..400
road(0, -230, 12, 340, true);  // sjever: z -400..-60
// gradić — ulice
road(0, 150, 10, 620, false);  // E-W kroz stanicu i do parkinga (x -310..310)
road(0, 250, 10, 420, false);  // E-W (x -210..210)
road(-120, 200, 8, 120, true); // N-S spojnice grada
road(120, 200, 8, 120, true);
// autoput
road(0, -250, 22, 920, false);
// prilaz parkingu
road(250, 172, 8, 45, true);

// crte na cestama (instanced — 1 draw call)
{
  const dashGeo = new THREE.BoxGeometry(0.25, 0.02, 3);
  const dashes = [];
  for (let z = -395; z <= -65; z += 9) dashes.push([0, z, 0]);
  for (let z = 65; z <= 395; z += 9) dashes.push([0, z, 0]);
  for (let x = -445; x <= 445; x += 9) { dashes.push([x, -250, 1]); }
  for (let x = -300; x <= 300; x += 9) if (Math.abs(x) > 8) dashes.push([x, 150, 1]);
  const im = new THREE.InstancedMesh(dashGeo, mat(0xffffff), dashes.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  dashes.forEach((d, i) => {
    q.setFromAxisAngle(up, d[2] ? Math.PI / 2 : 0);
    p.set(d[0], 0.1, d[1]);
    m4.compose(p, q, sc);
    im.setMatrixAt(i, m4);
  });
  scene.add(im);
}

// zebre na raskrižjima gradića
{
  const zebGeo = new THREE.BoxGeometry(0.9, 0.02, 4);
  const spots = [];
  for (const iz of [150, 250]) for (let i = -3; i <= 3; i++) { spots.push([i * 1.6, iz - 8]); spots.push([i * 1.6, iz + 8]); }
  const im = new THREE.InstancedMesh(zebGeo, mat(0xf0f0f0), spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach((s, i) => { m4.makeTranslation(s[0], 0.11, s[1]); im.setMatrixAt(i, m4); });
  scene.add(im);
}

// ---------------------------------------------------------------- most s lukovima
{
  const deckMat = mat(0x9aa0a8);
  const deck = box(16, 1, 62, 0x9aa0a8, 0, 5.5, 0);
  // rampe
  const rampLen = Math.sqrt(30 * 30 + 6 * 6);
  const ang = Math.atan2(6, 30);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, rampLen), deckMat);
  r1.position.set(0, 2.8, 45); r1.rotation.x = ang; scene.add(r1);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, rampLen), deckMat);
  r2.position.set(0, 2.8, -45); r2.rotation.x = -ang; scene.add(r2);
  // lukovi
  const archGeo = new THREE.TorusGeometry(26, 1.1, 6, 20, Math.PI);
  for (const sx of [-7.5, 7.5]) {
    const arch = new THREE.Mesh(archGeo, mat(0xd94f3d));
    arch.rotation.y = Math.PI / 2;
    arch.position.set(sx, 6, 0);
    scene.add(arch);
    // vješaljke
    for (const hz of [-18, -9, 0, 9, 18]) {
      const hh = 26 * Math.sin(Math.acos(Math.min(1, Math.abs(hz) / 26)));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, hh, 6), mat(0xd94f3d));
      c.position.set(sx, 6 + hh / 2, hz);
      scene.add(c);
    }
  }
  // stupovi u vodi
  for (const pz of [-20, 20]) for (const px of [-6, 6]) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 6, 8), mat(0x8a8f96));
    pil.position.set(px, 2.5, pz);
    scene.add(pil);
  }
  // ograda
  for (const sx of [-7.8, 7.8]) box(0.4, 0.8, 62, 0xcfd4da, sx, 6.4, 0);
}

// ---------------------------------------------------------------- gradić
{
  const bodies = [], roofs = [];
  const houseSpots = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const street = i % 4 < 2 ? 150 : 250;
    let x = -260 + rng() * 520;
    let z = street + side * (12 + rng() * 24);
    if (Math.abs(x) < 14 || onRoad(x, z)) { x += 40 * (x < 0 ? -1 : 1); }
    if (onRoad(x, z) || Math.abs(x) > 300 || z < 100 || z > 320) continue;
    houseSpots.push({ x, z, w: 8 + rng() * 5, h: 5 + rng() * 3, hue: rng() });
  }
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.ConeGeometry(0.82, 0.5, 4);
  const bodyIM = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), houseSpots.length);
  const roofIM = new THREE.InstancedMesh(roofGeo, mat(0xc0392b), houseSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const palette = [0xf5e6c8, 0xe8d2b0, 0xfdf3dd, 0xd9e4f0, 0xf0e0e0];
  houseSpots.forEach((h, i) => {
    q.identity();
    p.set(h.x, h.h / 2, h.z); s.set(h.w, h.h, h.w * 0.8);
    m4.compose(p, q, s); bodyIM.setMatrixAt(i, m4);
    bodyIM.setColorAt(i, col.setHex(palette[i % palette.length]));
    q.setFromAxisAngle(up, Math.PI / 4);
    p.set(h.x, h.h + h.w * 0.25, h.z); s.set(h.w * 1.05, h.w, h.w * 1.05);
    m4.compose(p, q, s); roofIM.setMatrixAt(i, m4);
    addCollider(h.x, h.z, h.w * 0.7);
  });
  scene.add(bodyIM); scene.add(roofIM);
}

// drveće (instanced debla + krošnje)
{
  const spots = [];
  let guard = 0;
  while (spots.length < 46 && guard++ < 400) {
    const x = -440 + rng() * 880, z = -440 + rng() * 880;
    if (Math.abs(z) < 34) continue;                       // rijeka
    if (onRoad(x, z)) continue;
    if (x > 205 && x < 295 && z > 150 && z < 220) continue; // parking
    if (z < -180 && z > -320) continue;                    // pojas autoputa/vjetrenjača
    if (z > 95 && z < 330 && Math.abs(x) < 310) {          // u gradu samo uz ulice
      if (Math.abs(z - 150) > 20 && Math.abs(z - 250) > 20) continue;
    }
    spots.push({ x, z, s: 0.8 + rng() * 0.7 });
  }
  const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6), mat(0x7a5230), spots.length);
  const crownIM = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 5, 7), mat(0x2f9e44), spots.length);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
  spots.forEach((t, i) => {
    p.set(t.x, 1.2 * t.s, t.z); s.set(t.s, t.s, t.s);
    m4.compose(p, q, s); trunkIM.setMatrixAt(i, m4);
    p.set(t.x, (2.4 + 2.5) * t.s, t.z);
    m4.compose(p, q, s); crownIM.setMatrixAt(i, m4);
    addCollider(t.x, t.z, 1.1 * t.s);
  });
  scene.add(trunkIM); scene.add(crownIM);
}

// brda u daljini
for (let i = 0; i < 11; i++) {
  const a = i / 11 * Math.PI * 2 + 0.3;
  const r = 720 + rng() * 120;
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(90 + rng() * 110, 50 + rng() * 70, 7),
    mat(i % 3 ? 0x5da24a : 0x6f9e5e)
  );
  hill.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  scene.add(hill);
}

// oblaci
const clouds = [];
{
  const puffGeo = new THREE.SphereGeometry(1, 7, 5);
  const cloudMat = mat(0xffffff, { emissive: 0x888888 });
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(puffGeo, cloudMat);
      m.position.set(j * 7 - 7, rng() * 2, rng() * 4 - 2);
      m.scale.set(6 + rng() * 4, 3 + rng() * 1.5, 4 + rng() * 2);
      g.add(m);
    }
    g.position.set(-450 + rng() * 900, 90 + rng() * 60, -450 + rng() * 900);
    scene.add(g);
    clouds.push(g);
  }
}

// ---------------------------------------------------------------- semafori (stvarno rade)
const trafficLights = { cycle: 0, nsGreen: true, heads: [] };
{
  const offGeo = new THREE.CircleGeometry(0.16, 8);
  const matOn = {
    r: mat(0xff2222, { emissive: 0xff0000, emissiveIntensity: 1 }),
    y: mat(0xffcc00, { emissive: 0xffaa00, emissiveIntensity: 1 }),
    g: mat(0x33ff44, { emissive: 0x00cc22, emissiveIntensity: 1 })
  };
  const matOff = { r: mat(0x551111), y: mat(0x554411), g: mat(0x115511) };
  function head(x, z, ry, axis) {
    const g = new THREE.Group();
    const bx = box(0.5, 1.4, 0.3, 0x222222, 0, 0, 0, g);
    const lights = {};
    for (const [i, c] of ['r', 'y', 'g'].entries()) {
      const l = new THREE.Mesh(offGeo, matOff[c]);
      l.position.set(0, 0.42 - i * 0.42, 0.16);
      g.add(l);
      lights[c] = l;
    }
    g.position.set(x, 4.6, z);
    g.rotation.y = ry;
    scene.add(g);
    trafficLights.heads.push({ lights, axis, matOn, matOff });
  }
  for (const iz of [150, 250]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.2, 6), mat(0x333333));
    pole.position.set(7, 2.6, iz - 7);
    scene.add(pole);
    addCollider(7, iz - 7, 0.6);
    head(7, iz - 7, Math.PI, 'ns');       // gleda prema jugu (za vozila koja idu na sjever)
    head(6.2, iz - 6.2, Math.PI / 2, 'ew'); // gleda prema istoku
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.2, 6), mat(0x333333));
    pole2.position.set(-7, 2.6, iz + 7);
    scene.add(pole2);
    addCollider(-7, iz + 7, 0.6);
    head(-7, iz + 7, 0, 'ns');
    head(-6.2, iz + 6.2, -Math.PI / 2, 'ew');
  }
}
function updateTrafficLights(dt) {
  trafficLights.cycle = (trafficLights.cycle + dt) % 16;
  const t = trafficLights.cycle;
  const nsState = t < 6.5 ? 'g' : t < 8 ? 'y' : 'r';
  const ewState = t < 8 ? 'r' : t < 14.5 ? 'g' : 'y';
  trafficLights.nsGreen = nsState === 'g';
  for (const h of trafficLights.heads) {
    const st = h.axis === 'ns' ? nsState : ewState;
    for (const c of ['r', 'y', 'g']) h.lights[c].material = c === st ? h.matOn[c] : h.matOff[c];
  }
}

// ---------------------------------------------------------------- autoput + vjetrenjače
const windmills = [];
{
  const bladeSingle = new THREE.BoxGeometry(0.9, 11, 0.4).translate(0, 5.8, 0);
  const b2 = bladeSingle.clone().rotateZ(Math.PI * 2 / 3);
  const b3 = bladeSingle.clone().rotateZ(Math.PI * 4 / 3);
  const rotorGeo = mergeGeos([bladeSingle, b2, b3]);
  const poleGeo = new THREE.CylinderGeometry(0.7, 1.3, 30, 8);
  const nacGeo = new THREE.BoxGeometry(2.2, 2, 3.5);
  const white = mat(0xf4f6f8);
  for (let i = 0; i < 13; i++) {
    const x = -420 + i * 70;
    const z = -292;
    const pole = new THREE.Mesh(poleGeo, white);
    pole.position.set(x, 15, z);
    scene.add(pole);
    const nac = new THREE.Mesh(nacGeo, white);
    nac.position.set(x, 30.5, z);
    scene.add(nac);
    const rotor = new THREE.Mesh(rotorGeo, white);
    rotor.position.set(x, 30.5, z + 2.1);
    scene.add(rotor);
    windmills.push({ rotor, speed: 0.5 + (i % 5) * 0.35 });
    addCollider(x, z, 2);
  }
}

// ---------------------------------------------------------------- parking
const parkingSpot = { x: 246, z: 198 };
let greenPad;
{
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(80, 55), mat(0x4a4e54));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(250, 0.07, 187);
  scene.add(lot);
  roads.push({ x1: 210, x2: 290, z1: 160, z2: 214 });
  // crte parkirnih mjesta
  const lineGeo = new THREE.BoxGeometry(0.3, 0.02, 9);
  const lines = [];
  for (let i = 0; i <= 9; i++) lines.push([216 + i * 7.5, 205]);
  const im = new THREE.InstancedMesh(lineGeo, mat(0xffffff), lines.length);
  const m4 = new THREE.Matrix4();
  lines.forEach((l, i) => { m4.makeTranslation(l[0], 0.12, l[1]); im.setMatrixAt(i, m4); });
  scene.add(im);
  // zeleno mjesto koje pulsira
  greenPad = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 8.6),
    new THREE.MeshLambertMaterial({ color: 0x2fae4a, emissive: 0x1d7a30, transparent: true, opacity: 0.85 }));
  greenPad.rotation.x = -Math.PI / 2;
  greenPad.position.set(parkingSpot.x, 0.13, parkingSpot.z + 3);
  scene.add(greenPad);
}

// ---------------------------------------------------------------- stanica hitnih službi
function serviceBuilding(x, z, w, h, d, color, extra) {
  const b = box(w, h, d, color, x, h / 2, z);
  addCollider(x, z, Math.max(w, d) * 0.62);
  const roof = box(w + 1, 0.6, d + 1, 0x8a8f96, x, h + 0.3, z);
  if (extra) extra(x, z, w, h, d);
  return b;
}
// vatrogasni dom
serviceBuilding(-280, 188, 22, 9, 16, 0xc0392b, (x, z, w, h) => {
  box(6, 6.5, 0.4, 0x772211, x - 6, 3.2, z - 8.2); // velika vrata
  box(6, 6.5, 0.4, 0x772211, x + 6, 3.2, z - 8.2);
  box(3.5, 3.5, 0.3, 0xffd400, x, h + 2.4, z - 7.6); // žuti znak
});
// policija
serviceBuilding(-240, 186, 16, 8, 13, 0x3b6ea5, (x, z, w, h) => {
  box(4, 3, 0.4, 0xbcd6ee, x, 4, z - 6.6);
  const bea = box(1.2, 0.7, 1.2, 0x2244ff, x, h + 0.9, z);
  bea.material = mat(0x2244ff, { emissive: 0x2244ff, emissiveIntensity: 0.8 });
});
// bolnica
serviceBuilding(-196, 190, 18, 12, 15, 0xf4f6f8, (x, z, w, h) => {
  box(5, 1.4, 0.4, 0xe03131, x, h - 2, z - 7.6); // crveni križ
  box(1.4, 5, 0.4, 0xe03131, x, h - 2, z - 7.6);
});

// ---------------------------------------------------------------- brodić
const boat = new THREE.Group();
{
  box(9, 1.6, 3, 0xf4f6f8, 0, 0.8, 0, boat);
  box(4, 1.6, 2.2, 0x3b6ea5, -0.5, 2.4, 0, boat);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 8), mat(0xe03131));
  chim.position.set(-2.6, 3, 0); boat.add(chim);
  box(0.15, 3, 0.15, 0x7a5230, 3, 3, 0, boat);
  box(1.4, 0.8, 0.06, 0xffd400, 3.7, 4, 0, boat);
  boat.position.set(-460, 0.4, 2);
  scene.add(boat);
}

// ---------------------------------------------------------------- vozila (builderi)
const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10).rotateZ(Math.PI / 2);
const wheelMat = mat(0x1c1c1e);
const hubMat = mat(0x9aa0a8);
function makeWheel(scale) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 8).rotateZ(Math.PI / 2), hubMat);
  g.add(w); g.add(hub);
  if (scale) g.scale.setScalar(scale);
  return g;
}

// ŽUTI YUGO 45 — kockasta silueta: kratka hauba, strma ravna zadnja (hatchback)
function buildYugo() {
  const g = new THREE.Group();
  const yellow = mat(0xffd400);
  const black = mat(0x1c1c1e);
  const glass = mat(0x2a3742);
  // donji dio karoserije
  box(1.62, 0.52, 3.35, 0xffd400, 0, 0.62, 0.02, g);
  // kratka hauba sprijeda (niža)
  box(1.56, 0.3, 0.72, 0xffd400, 0, 0.98, -1.28, g);
  // kabina — pomaknuta prema natrag, ravna zadnja
  box(1.5, 0.62, 2.05, 0xffd400, 0, 1.28, 0.35, g);
  // stakla (tamna): vjetrobran nagnut, bočna, ravna zadnja
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.6), glass);
  ws.position.set(0, 1.32, -0.62); ws.rotation.x = -0.42; g.add(ws);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.56), glass);
  rw.position.set(0, 1.32, 1.39); rw.rotation.x = Math.PI + 0.1; g.add(rw);
  for (const s of [-0.76, 0.76]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.5), glass);
    sw.position.set(s, 1.3, 0.35); sw.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(sw);
  }
  // crni branici + bočne letvice
  box(1.7, 0.16, 0.18, 0x1c1c1e, 0, 0.42, -1.72, g);
  box(1.7, 0.16, 0.18, 0x1c1c1e, 0, 0.42, 1.74, g);
  for (const s of [-0.82, 0.82]) box(0.05, 0.1, 3.3, 0x1c1c1e, s, 0.62, 0, g);
  // maska + kvadratna svjetla + žmigavci
  box(0.9, 0.14, 0.06, 0x1c1c1e, 0, 0.82, -1.69, g);
  const lightMat = mat(0xfffbe0, { emissive: 0xfff2b0, emissiveIntensity: 0.7 });
  for (const s of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.06), lightMat);
    hl.position.set(s, 0.82, -1.69); g.add(hl);
    box(0.14, 0.12, 0.06, 0xff9500, s > 0 ? 0.78 : -0.78, 0.6, -1.7, g);
    box(0.24, 0.16, 0.06, 0xd0021b, s, 0.85, 1.72, g);
  }
  // retrovizori
  for (const s of [-0.84, 0.84]) box(0.08, 0.12, 0.06, 0x1c1c1e, s, 1.15, -0.55, g);
  // registarska (bijela pločica)
  box(0.5, 0.14, 0.03, 0xf0f0f0, 0, 0.55, 1.76, g);
  // kotači: prednji u "steer" grupama
  const wheels = { spin: [], steerL: null, steerR: null };
  for (const [sx, sz, front] of [[-0.78, -1.05, true], [0.78, -1.05, true], [-0.78, 1.1, false], [0.78, 1.1, false]]) {
    const w = makeWheel();
    if (front) {
      const st = new THREE.Group();
      st.position.set(sx, 0.34, sz);
      st.add(w);
      g.add(st);
      if (sx < 0) wheels.steerL = st; else wheels.steerR = st;
    } else {
      w.position.set(sx, 0.34, sz);
      g.add(w);
    }
    wheels.spin.push(w);
  }
  addShadow(g, 1.35, 2.1);
  return { group: g, wheels };
}

// generični auto za NPC-e
function buildCar(color, len, cabColor) {
  const g = new THREE.Group();
  const L = len || 3.4;
  box(1.7, 0.55, L, color, 0, 0.62, 0, g);
  box(1.55, 0.55, L * 0.5, cabColor || color, 0, 1.15, L * 0.05, g);
  box(1.75, 0.15, 0.16, 0x1c1c1e, 0, 0.4, -L / 2 - 0.02, g);
  box(1.75, 0.15, 0.16, 0x1c1c1e, 0, 0.4, L / 2 + 0.02, g);
  const spin = [];
  for (const [sx, sz] of [[-0.8, -L * 0.32], [0.8, -L * 0.32], [-0.8, L * 0.32], [0.8, L * 0.32]]) {
    const w = makeWheel();
    w.position.set(sx, 0.34, sz);
    g.add(w);
    spin.push(w);
  }
  addShadow(g, 1.4, L * 0.62);
  return { group: g, spin };
}

// rotirka (svjetla koja se vrte)
function makeBeacon(colors, y, z, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(0, y, z || 0);
  colors.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28),
      mat(c, { emissive: c, emissiveIntensity: 1 }));
    m.position.x = colors.length > 1 ? (i ? 0.3 : -0.3) : 0;
    pivot.add(m);
  });
  parent.add(pivot);
  return pivot;
}

function buildFireTruck() {
  const g = new THREE.Group();
  box(2.1, 1.5, 2, 0xd0021b, 0, 1.15, -2.2, g);   // kabina
  box(2.1, 1.6, 4.4, 0xd0021b, 0, 1.2, 1.1, g);   // sanduk
  box(1.9, 0.5, 1.2, 0xbcd6ee, 0, 1.6, -2.85, g); // vjetrobran
  // ljestve
  const ladder = new THREE.Group();
  for (const s of [-0.45, 0.45]) box(0.12, 0.12, 4.6, 0xdadde0, s, 0, 0, ladder);
  for (let i = -2; i <= 2; i++) box(0.95, 0.1, 0.1, 0xdadde0, 0, 0, i * 1.05, ladder);
  ladder.position.set(0, 2.25, 1.1);
  ladder.rotation.x = -0.1;
  g.add(ladder);
  const beacon = makeBeacon([0xff2222, 0xff8800], 2.1, -2.2, g);
  const spin = [];
  for (const [sx, sz] of [[-1, -2.2], [1, -2.2], [-1, 0.4], [1, 0.4], [-1, 1.9], [1, 1.9]]) {
    const w = makeWheel(1.25);
    w.position.set(sx, 0.42, sz);
    g.add(w);
    spin.push(w);
  }
  addShadow(g, 1.7, 3.6);
  return { group: g, spin, beacon };
}

function buildAmbulance() {
  const g = new THREE.Group();
  box(2, 1.3, 1.8, 0xf4f6f8, 0, 1, -1.9, g);
  box(2.1, 2, 3.4, 0xf4f6f8, 0, 1.35, 0.8, g);
  box(2.14, 0.35, 3.4, 0xe03131, 0, 1.1, 0.8, g);   // crvena traka
  box(0.9, 0.9, 0.06, 0xe03131, 0, 1.8, 2.53, g);    // križ straga
  box(1.8, 0.5, 1.1, 0xbcd6ee, 0, 1.4, -2.5, g);
  const beacon = makeBeacon([0x2266ff, 0x2266ff], 2.55, 0.2, g);
  const spin = [];
  for (const [sx, sz] of [[-0.95, -1.7], [0.95, -1.7], [-0.95, 1.6], [0.95, 1.6]]) {
    const w = makeWheel(1.15);
    w.position.set(sx, 0.39, sz);
    g.add(w);
    spin.push(w);
  }
  addShadow(g, 1.6, 3);
  return { group: g, spin, beacon };
}

function buildPolice() {
  const car = buildCar(0xf4f6f8, 3.6, 0x3b6ea5);
  const g = car.group;
  box(1.5, 0.12, 3.6, 0x3b6ea5, 0, 0.9, 0, g); // plava pruga
  const bar = new THREE.Group();
  const rMat = mat(0xff2222, { emissive: 0xff0000, emissiveIntensity: 1 });
  const bMat = mat(0x2266ff, { emissive: 0x1144ff, emissiveIntensity: 1 });
  const rl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.3), rMat); rl.position.x = -0.25;
  const bl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.3), bMat); bl.position.x = 0.25;
  bar.add(rl); bar.add(bl);
  bar.position.set(0, 1.55, 0.1);
  g.add(bar);
  return { group: g, spin: car.spin, bar, rl, bl };
}

function buildTowTruck() {
  const g = new THREE.Group();
  box(2, 1.4, 1.9, 0xff8800, 0, 1.05, -1.8, g);
  box(1.9, 0.3, 3, 0x6b6f75, 0, 0.75, 0.9, g); // ravna platforma
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.6), mat(0x444444));
  boom.position.set(0, 1.6, 1.6);
  boom.rotation.x = 0.5;
  g.add(boom);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), mat(0x222222));
  hook.position.set(0, 1.3, 2.7);
  g.add(hook);
  const spin = [];
  for (const [sx, sz] of [[-0.95, -1.7], [0.95, -1.7], [-0.95, 1.4], [0.95, 1.4]]) {
    const w = makeWheel(1.15);
    w.position.set(sx, 0.39, sz);
    g.add(w);
    spin.push(w);
  }
  addShadow(g, 1.6, 2.9);
  return { group: g, spin };
}

// ---------------------------------------------------------------- Yugo — igrač
const yugo = buildYugo();
scene.add(yugo.group);
const player = {
  x: 0, z: 340, heading: Math.PI, speed: 0,
  steer: 0, steerTarget: 0, throttle: 0, brake: 0,
  collideCooldown: 0
};
yugo.group.position.set(player.x, 0, player.z);
yugo.group.rotation.y = player.heading;

// "Bip-bip!" oblačić (canvas → sprite; crtano kodom, nije datoteka)
let bipSprite, bipTimer = 0;
{
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, 236, 84, 26);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(105, 92); ctx.lineTo(88, 122); ctx.lineTo(140, 92);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Bip-bip!', 128, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  bipSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  bipSprite.scale.set(3.4, 1.7, 1);
  bipSprite.visible = false;
  scene.add(bipSprite);
}

// strelica-vodič iznad Yuga
const guideArrow = new THREE.Group();
{
  const oMat = mat(0xff7a00, { emissive: 0xff5500, emissiveIntensity: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 8).rotateX(Math.PI / 2), oMat);
  shaft.position.z = -0.2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 10).rotateX(Math.PI / 2), oMat);
  tip.position.z = 0.85;
  guideArrow.add(shaft); guideArrow.add(tip);
  scene.add(guideArrow);
}

// ---------------------------------------------------------------- NPC vozila
const npcs = [];
function addNPC(built, pts, speed, opts) {
  const n = Object.assign({
    obj: built.group, spin: built.spin || [], beacon: built.beacon || null,
    pts, idx: 0, dir: 1, pingpong: false, speed, v: 0,
    heading: 0, stopsAtLights: false, beaconSpeed: 3
  }, opts || {});
  n.obj.position.set(pts[0].x, 0, pts[0].z);
  scene.add(n.obj);
  npcs.push(n);
  return n;
}
// 🚒 vatrogasci — ulicom z=150
const fireTruck = addNPC(buildFireTruck(),
  [{ x: -285, z: 152 }, { x: 195, z: 152 }], 7, { pingpong: true, stopsAtLights: true });
fireTruck.intervention = 0; fireTruck.nextIntervention = 18;
// 🚑 hitna — od bolnice preko mosta na sjever
addNPC(buildAmbulance(),
  [{ x: -196, z: 147 }, { x: -3, z: 147 }, { x: -3, z: -120 }], 8,
  { pingpong: true, stopsAtLights: true, beaconSpeed: 6 });
// 🚓 policija — kruži gradićem
const police = buildPolice();
const policeNpc = addNPC(police,
  [{ x: -118, z: 153 }, { x: 118, z: 153 }, { x: 118, z: 247 }, { x: -118, z: 247 }], 6,
  { stopsAtLights: true });
policeNpc.flash = 0; policeNpc.flashCooldown = 0;
// 🛻 vučna služba s pokvarenim autom — autoput
const towNpc = addNPC(buildTowTruck(),
  [{ x: 430, z: -245 }, { x: -430, z: -245 }, { x: -430, z: -256 }, { x: 430, z: -256 }], 6.5, {});
const brokenCar = buildCar(0xb0a58e, 3.2);
brokenCar.group.rotation.z = 0.03;
scene.add(brokenCar.group);
// obični autići
addNPC(buildCar(0x4a90d9, 3.4, 0x3a70a9), [{ x: 3, z: 380 }, { x: 3, z: -380 }, { x: -3, z: -380 }, { x: -3, z: 380 }], 7.5, { stopsAtLights: true });
addNPC(buildCar(0x7ed321, 3.3), [{ x: -118, z: 247 }, { x: 118, z: 247 }, { x: 118, z: 153 }, { x: -118, z: 153 }], 5.5, { stopsAtLights: true });
addNPC(buildCar(0xd0619b, 3.4, 0xa04a78), [{ x: 430, z: -252 }, { x: -430, z: -252 }, { x: -430, z: -243 }, { x: 430, z: -243 }], 9, {});

function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function updateNPC(n, dt) {
  const tgt = n.pts[n.idx];
  const dx = tgt.x - n.obj.position.x;
  const dz = tgt.z - n.obj.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    if (n.pingpong) {
      const next = n.idx + n.dir;
      if (next < 0 || next >= n.pts.length) n.dir *= -1;
      n.idx += n.dir;
    } else {
      n.idx = (n.idx + 1) % n.pts.length;
    }
  }
  const desired = Math.atan2(dx, dz);
  n.heading = angLerp(n.heading, desired, Math.min(1, dt * 2.5));
  // uspori/stani ako je Yugo ispred
  let targetV = n.speed;
  const pdx = player.x - n.obj.position.x;
  const pdz = player.z - n.obj.position.z;
  const pd = Math.hypot(pdx, pdz);
  if (pd < 14) {
    const fx = Math.sin(n.heading), fz = Math.cos(n.heading);
    const dot = (pdx * fx + pdz * fz) / (pd || 1);
    if (dot > 0.4) targetV = pd < 7 ? 0 : n.speed * 0.3;
  }
  // semafori (samo raskrižja glavne ceste u gradiću)
  if (n.stopsAtLights) {
    const fx = Math.sin(n.heading), fz = Math.cos(n.heading);
    const movingNS = Math.abs(fz) > 0.7;
    for (const iz of [150, 250]) {
      if (movingNS && !trafficLights.nsGreen && Math.abs(n.obj.position.x) < 8) {
        const ahead = (iz - n.obj.position.z) * Math.sign(fz);
        if (ahead > 8 && ahead < 17) targetV = 0;
      }
      if (!movingNS && trafficLights.nsGreen && Math.abs(n.obj.position.z - iz) < 6) {
        const ahead = (0 - n.obj.position.x) * Math.sign(fx);
        if (ahead > 8 && ahead < 17) targetV = 0;
      }
    }
  }
  n.v += (targetV - n.v) * Math.min(1, dt * 3);
  const step = n.v * dt;
  n.obj.position.x += Math.sin(n.heading) * step;
  n.obj.position.z += Math.cos(n.heading) * step;
  n.obj.position.y = terrainHeight(n.obj.position.x, n.obj.position.z);
  n.obj.rotation.y = n.heading;
  for (const w of n.spin) w.children[0].rotation.x += n.v * dt * 3;
  if (n.beacon) n.beacon.rotation.y += dt * n.beaconSpeed;
}

// 🕷️ pauk na parkingu — diže sivi auto na platformu u petlji
const pauk = { t: 0 };
{
  const g = new THREE.Group();
  box(2, 1.4, 1.9, 0x555a60, 0, 1.05, -2.1, g);   // kabina
  box(2, 0.35, 3.6, 0x6b6f75, 0, 0.85, 0.7, g);   // platforma
  const armBase = new THREE.Group();
  armBase.position.set(0, 1.1, 2.2);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.6, 8), mat(0xffd400));
  post.position.y = 0.8;
  armBase.add(post);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 4.4), mat(0xffd400));
  boom.position.set(0, 1.6, 1.4);
  boom.rotation.x = 0.35;
  armBase.add(boom);
  g.add(armBase);
  for (const [sx, sz] of [[-0.95, -1.9], [0.95, -1.9], [-0.95, 1.6], [0.95, 1.6]]) {
    const w = makeWheel(1.1);
    w.position.set(sx, 0.37, sz);
    g.add(w);
  }
  addShadow(g, 1.6, 3);
  g.position.set(268, 0, 178);
  g.rotation.y = -Math.PI / 2;
  scene.add(g);
  addCollider(268, 178, 3.4);
  pauk.truck = g;
  pauk.arm = armBase;
  const grey = buildCar(0x9aa0a8, 3.1);
  scene.add(grey.group);
  pauk.car = grey.group;
  pauk.ground = { x: 268, z: 188 };  // auto na tlu pored pauka
  pauk.plat = { x: 265.8, z: 178 };  // na platformi
  addCollider(268, 188, 2.2);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function updatePauk(dt) {
  pauk.t = (pauk.t + dt) % 14;
  const t = pauk.t;
  let lift = 0; // 0 = na tlu, 1 = na platformi
  if (t < 2.5) lift = 0;
  else if (t < 6) lift = smooth((t - 2.5) / 3.5);
  else if (t < 8.5) lift = 1;
  else if (t < 12) lift = 1 - smooth((t - 8.5) / 3.5);
  else lift = 0;
  const arc = Math.sin(lift * Math.PI) * 2.6;
  pauk.car.position.x = pauk.ground.x + (pauk.plat.x - pauk.ground.x) * lift;
  pauk.car.position.z = pauk.ground.z + (pauk.plat.z - pauk.ground.z) * lift;
  pauk.car.position.y = lift * 1.05 + arc;
  pauk.car.rotation.y = -Math.PI / 2 + lift * 0.15;
  const adx = pauk.car.position.x - pauk.truck.position.x;
  const adz = pauk.car.position.z - pauk.truck.position.z;
  pauk.arm.rotation.y = angLerp(pauk.arm.rotation.y, Math.atan2(adx, adz) - pauk.truck.rotation.y, Math.min(1, dt * 3));
}

// ---------------------------------------------------------------- zvjezdice za skupljanje
const stars = [];
let starCount = 0;
const starCountEl = document.getElementById('starCount');
{
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : 0.45;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
  starGeo.center();
  const starMat = mat(0xffd400, { emissive: 0xcc9900, emissiveIntensity: 0.55 });
  const places = [
    [0, 320], [0, 200], [0, 0], [0, -150], [60, -250],
    [-200, -250], [120, 200], [-120, 200], [250, 158], [-150, 150]
  ];
  for (const [x, z] of places) {
    const m = new THREE.Mesh(starGeo, starMat);
    m.position.set(x, terrainHeight(x, z) + 1.6, z);
    m.scale.setScalar(0.9);
    scene.add(m);
    stars.push({ mesh: m, x, z, taken: false, base: terrainHeight(x, z) + 1.6 });
  }
}
function setStarCount(n) {
  starCount = n;
  starCountEl.textContent = '⭐ ' + n;
}

// ---------------------------------------------------------------- konfeti (Points pool, 1 draw call)
const CONFETTI_N = 220;
const confetti = { life: 0 };
{
  const posArr = new Float32Array(CONFETTI_N * 3);
  const colArr = new Float32Array(CONFETTI_N * 3);
  confetti.vel = new Float32Array(CONFETTI_N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.setDrawRange(0, 0);
  const pmat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, sizeAttenuation: true });
  confetti.points = new THREE.Points(geo, pmat);
  confetti.points.frustumCulled = false;
  scene.add(confetti.points);
  confetti.pos = posArr;
  confetti.col = colArr;
  confetti.geo = geo;
}
const CONF_COLORS = [[1, 0.2, 0.3], [1, 0.85, 0], [0.2, 0.8, 1], [0.4, 1, 0.4], [1, 0.5, 1], [1, 0.6, 0.1]];
function burstConfetti(x, y, z) {
  for (let i = 0; i < CONFETTI_N; i++) {
    const i3 = i * 3;
    confetti.pos[i3] = x; confetti.pos[i3 + 1] = y; confetti.pos[i3 + 2] = z;
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 6;
    confetti.vel[i3] = Math.cos(a) * sp;
    confetti.vel[i3 + 1] = 4 + Math.random() * 7;
    confetti.vel[i3 + 2] = Math.sin(a) * sp;
    const c = CONF_COLORS[i % CONF_COLORS.length];
    confetti.col[i3] = c[0]; confetti.col[i3 + 1] = c[1]; confetti.col[i3 + 2] = c[2];
  }
  confetti.geo.attributes.color.needsUpdate = true;
  confetti.geo.setDrawRange(0, CONFETTI_N);
  confetti.life = 2.4;
}
function updateConfetti(dt) {
  if (confetti.life <= 0) return;
  confetti.life -= dt;
  if (confetti.life <= 0) { confetti.geo.setDrawRange(0, 0); return; }
  for (let i = 0; i < CONFETTI_N; i++) {
    const i3 = i * 3;
    confetti.vel[i3 + 1] -= 9.5 * dt;
    confetti.pos[i3] += confetti.vel[i3] * dt;
    confetti.pos[i3 + 1] += confetti.vel[i3 + 1] * dt;
    confetti.pos[i3 + 2] += confetti.vel[i3 + 2] * dt;
    if (confetti.pos[i3 + 1] < 0.1) confetti.pos[i3 + 1] = 0.1;
  }
  confetti.geo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- Web Audio (sinteza, otključava se dodirom)
const AudioSys = { ctx: null, master: null, engine: null };
function initAudio() {
  if (AudioSys.ctx) { AudioSys.ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  AudioSys.ctx = ctx;
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  AudioSys.master = master;
  // motor: 2 oscilatora + lowpass
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'square';
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 1;
  const g = ctx.createGain(); g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
  o1.frequency.value = 55; o2.frequency.value = 28;
  o1.start(); o2.start();
  AudioSys.engine = { o1, o2, g };
}
function beep(freq, dur, type, gainV, when) {
  const { ctx, master } = AudioSys;
  if (!ctx) return;
  const t = ctx.currentTime + (when || 0);
  const o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gainV || 0.12, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function sndHorn() {
  beep(495, 0.16, 'square', 0.14, 0);
  beep(370, 0.16, 'square', 0.14, 0);
  beep(495, 0.16, 'square', 0.14, 0.22);
  beep(370, 0.16, 'square', 0.14, 0.22);
}
function sndDing() { beep(988, 0.12, 'sine', 0.14, 0); beep(1319, 0.25, 'sine', 0.14, 0.1); }
function sndBoing() {
  const { ctx, master } = AudioSys;
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(340, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.28);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.35);
}
function sndMission() {
  [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.14, i * 0.13));
}
function sndBravo() {
  [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, 0.25, 'triangle', 0.15, i * 0.16));
}
function sndSiren(hi, lo, reps, gainV) {
  for (let i = 0; i < reps; i++) {
    beep(hi, 0.32, 'square', gainV, i * 0.7);
    beep(lo, 0.32, 'square', gainV, i * 0.7 + 0.35);
  }
}
function sndPoliceBlip() {
  const { ctx, master } = AudioSys;
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(950, t + 0.35);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.45);
}

// ---------------------------------------------------------------- ulazi (touch + tipkovnica, multi-touch)
const input = { left: false, right: false, gas: false, brake: false };
function bindButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  const ids = new Set();
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    ids.add(e.pointerId);
    el.classList.add('pressed');
    onDown();
  });
  const release = (e) => {
    if (!ids.has(e.pointerId)) return;
    ids.delete(e.pointerId);
    if (ids.size === 0) {
      el.classList.remove('pressed');
      if (onUp) onUp();
    }
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}
bindButton('btnL', () => { input.left = true; }, () => { input.left = false; });
bindButton('btnR', () => { input.right = true; }, () => { input.right = false; });
bindButton('btnGas', () => { input.gas = true; }, () => { input.gas = false; });
bindButton('btnBrake', () => { input.brake = true; }, () => { input.brake = false; });
bindButton('btnHorn', () => { doHorn(); });
bindButton('btnReset', () => { resetToRoad(); });

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': input.left = true; break;
    case 'ArrowRight': case 'd': case 'D': input.right = true; break;
    case 'ArrowUp': case 'w': case 'W': input.gas = true; break;
    case 'ArrowDown': case 's': case 'S': case ' ': input.brake = true; break;
    case 'h': case 'H': case 'Enter': doHorn(); break;
    case 'r': case 'R': resetToRoad(); break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': input.left = false; break;
    case 'ArrowRight': case 'd': case 'D': input.right = false; break;
    case 'ArrowUp': case 'w': case 'W': input.gas = false; break;
    case 'ArrowDown': case 's': case 'S': case ' ': input.brake = false; break;
  }
});
// spriječi scroll/zoom geste
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

function doHorn() {
  initAudio();
  sndHorn();
  bipTimer = 1.2;
  // policija odgovara bljeskanjem ako je blizu
  const dp = Math.hypot(player.x - policeNpc.obj.position.x, player.z - policeNpc.obj.position.z);
  const ds = Math.hypot(player.x + 240, player.z - 186);
  if ((dp < 25 || ds < 32) && policeNpc.flashCooldown <= 0) {
    policeNpc.flash = 3;
    policeNpc.flashCooldown = 8;
    sndPoliceBlip();
  }
  checkHornMission();
}

// ---------------------------------------------------------------- reset 🔄
const respawns = [
  { x: 0, z: 340, h: Math.PI }, { x: 0, z: 150, h: Math.PI }, { x: 0, z: 80, h: Math.PI },
  { x: 0, z: -100, h: Math.PI }, { x: 0, z: -250, h: Math.PI }, { x: 0, z: -350, h: Math.PI },
  { x: 150, z: 150, h: -Math.PI / 2 }, { x: -150, z: 150, h: Math.PI / 2 },
  { x: 250, z: 168, h: 0 }, { x: 150, z: -250, h: -Math.PI / 2 }, { x: -150, z: -250, h: Math.PI / 2 }
];
function resetToRoad() {
  let best = respawns[0], bd = Infinity;
  for (const r of respawns) {
    const d = (r.x - player.x) * (r.x - player.x) + (r.z - player.z) * (r.z - player.z);
    if (d < bd) { bd = d; best = r; }
  }
  player.x = best.x; player.z = best.z; player.heading = best.h;
  player.speed = 0;
}

// ---------------------------------------------------------------- misije
const MISSIONS = [
  { icon: '🌉', x: 0, z: 0, r: 15 },
  { icon: '🌬️', x: 60, z: -250, r: 18 },
  { icon: '🅿️', x: 246, z: 201, r: 4.5, park: true },
  { icon: '🚒', x: -280, z: 168, r: 15 },
  { icon: '🎺', x: -240, z: 165, r: 30, horn: true }
];
let missionIdx = 0, freeRide = false;
const missionIconEl = document.getElementById('missionIcon');
const splashEl = document.getElementById('splash');
const bravoEl = document.getElementById('bravo');
let bravoTimer = 0;
function showSplash(txt) {
  splashEl.textContent = txt;
  splashEl.classList.remove('show');
  void splashEl.offsetWidth; // restart animacije
  splashEl.classList.add('show');
}
function completeMission() {
  setStarCount(starCount + 1);
  burstConfetti(player.x, terrainHeight(player.x, player.z) + 2, player.z);
  sndMission();
  showSplash('⭐');
  missionIdx++;
  if (missionIdx >= MISSIONS.length) {
    freeRide = true;
    missionIconEl.textContent = '🏆';
    bravoTimer = 1.2; // kratka odgoda pa BRAVO ekran
  } else {
    missionIconEl.textContent = MISSIONS[missionIdx].icon;
  }
}
function checkHornMission() {
  if (freeRide || missionIdx >= MISSIONS.length) return;
  const m = MISSIONS[missionIdx];
  if (!m.horn) return;
  if (Math.hypot(player.x - m.x, player.z - m.z) < m.r) completeMission();
}
function updateMissions() {
  if (freeRide || missionIdx >= MISSIONS.length) return;
  const m = MISSIONS[missionIdx];
  if (m.horn) return; // čeka trubu
  const d = Math.hypot(player.x - m.x, player.z - m.z);
  if (d < m.r) {
    if (m.park && Math.abs(player.speed) > 1) return;
    completeMission();
  }
}
document.getElementById('btnGo').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  bravoEl.classList.remove('show');
});

// ---------------------------------------------------------------- fizika + petlja
const MAX_SPEED = 13, ACCEL = 6.5, BRAKE = 12, REVERSE_MAX = -4;
const camPos = new THREE.Vector3(0, 6, 352);
const camLook = new THREE.Vector3();
let hornSirenTimer = 20;
let started = false;
const clock = new THREE.Clock();

function updatePlayer(dt) {
  // upravljanje
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  player.steerTarget = steerIn;
  player.steer += (player.steerTarget - player.steer) * Math.min(1, dt * 7);
  // gas / kočnica / rikverc
  if (input.gas) player.speed += ACCEL * dt;
  if (input.brake) {
    if (player.speed > 0.3) player.speed -= BRAKE * dt;
    else player.speed -= ACCEL * 0.5 * dt; // lagani rikverc
  }
  // prirodno usporavanje + granice
  player.speed -= player.speed * 0.6 * dt;
  if (!input.gas && !input.brake && Math.abs(player.speed) < 0.15) player.speed = 0;
  player.speed = Math.max(REVERSE_MAX, Math.min(MAX_SPEED, player.speed));
  // skretanje ovisno o brzini (glatko i oprostivo)
  const turn = player.steer * Math.min(Math.abs(player.speed), 9) / 9 * 1.7;
  player.heading += turn * dt * Math.sign(player.speed || 1);
  // pomak + blago klizanje
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const slip = player.steer * player.speed * 0.05;
  player.x += (fx * player.speed + fz * slip) * dt;
  player.z += (fz * player.speed - fx * slip) * dt;
  // nevidljivi zidovi ruba mape
  if (player.x > 470) { player.x = 470; player.speed *= 0.4; }
  if (player.x < -470) { player.x = -470; player.speed *= 0.4; }
  if (player.z > 470) { player.z = 470; player.speed *= 0.4; }
  if (player.z < -470) { player.z = -470; player.speed *= 0.4; }
  // most: ograda drži auto na deku; rijeka: obale su zid
  const h = terrainHeight(player.x, player.z);
  if (h > 0.1) {
    if (player.x > 7.2) player.x = 7.2;
    if (player.x < -7.2) player.x = -7.2;
  } else if (Math.abs(player.z) < 27 && Math.abs(player.x) >= 9) {
    player.z = (player.z >= 0 ? 1 : -1) * 27;
    player.speed *= 0.3;
  }
  // statične prepreke — meko izguravanje
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const dx = player.x - c.x, dz = player.z - c.z;
    const rr = c.r + 1.4;
    if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (rr - d);
      player.x += dx / d * push;
      player.z += dz / d * push;
      player.speed *= 0.85;
    }
  }
  // NPC sudari — mekano odbijanje + boing
  player.collideCooldown -= dt;
  for (const n of npcs) {
    const dx = player.x - n.obj.position.x;
    const dz = player.z - n.obj.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 16 && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = 4 - d;
      player.x += dx / d * push;
      player.z += dz / d * push;
      if (player.collideCooldown <= 0) {
        player.speed *= -0.35;
        sndBoing();
        player.collideCooldown = 0.6;
      }
    }
  }
  // primjena na model
  const y = terrainHeight(player.x, player.z);
  yugo.group.position.set(player.x, y, player.z);
  yugo.group.rotation.y = player.heading;
  // nagib na rampama
  const hA = terrainHeight(player.x + fx * 1.6, player.z + fz * 1.6);
  const hB = terrainHeight(player.x - fx * 1.6, player.z - fz * 1.6);
  yugo.group.rotation.x = Math.atan2(hB - hA, 3.2);
  // kotači
  const steerAng = player.steer * 0.5;
  yugo.wheels.steerL.rotation.y = steerAng;
  yugo.wheels.steerR.rotation.y = steerAng;
  for (const w of yugo.wheels.spin) {
    (w.children ? w.children[0] : w).rotation.x += player.speed * dt * 3;
  }
  // motor zvuk
  if (AudioSys.engine) {
    const sp = Math.abs(player.speed);
    AudioSys.engine.o1.frequency.value = 50 + sp * 7 + (input.gas ? 12 : 0);
    AudioSys.engine.o2.frequency.value = 26 + sp * 3.5;
    AudioSys.engine.g.gain.value = started ? 0.035 + sp / MAX_SPEED * 0.075 : 0;
  }
}

function updateCamera(dt) {
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const y = terrainHeight(player.x, player.z);
  const tx = player.x - fx * 10.5;
  const tz = player.z - fz * 10.5;
  const k = 1 - Math.exp(-dt * 3.5);
  camPos.x += (tx - camPos.x) * k;
  camPos.y += (y + 5 - camPos.y) * k;
  camPos.z += (tz - camPos.z) * k;
  camera.position.copy(camPos);
  camLook.set(player.x + fx * 2, y + 1.6, player.z + fz * 2);
  camera.lookAt(camLook);
  camera.rotateZ(player.steer * Math.min(Math.abs(player.speed), 9) * 0.006); // blagi nagib u zavoju
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started) updatePlayer(dt);
  updateCamera(dt);
  updateTrafficLights(dt);
  for (const w of windmills) w.rotor.rotation.z += w.speed * dt;
  for (const n of npcs) updateNPC(n, dt);
  // pokvareni auto prati vučnu službu
  {
    const fx = Math.sin(towNpc.heading), fz = Math.cos(towNpc.heading);
    brokenCar.group.position.set(
      towNpc.obj.position.x - fx * 5.2, 0,
      towNpc.obj.position.z - fz * 5.2);
    brokenCar.group.rotation.y = towNpc.heading;
  }
  updatePauk(dt);
  // brodić plovi ispod mosta
  boat.position.x += 5 * dt;
  if (boat.position.x > 480) boat.position.x = -480;
  boat.position.y = 0.4 + Math.sin(clock.elapsedTime * 1.3) * 0.12;
  // oblaci lagano plove
  for (const c of clouds) {
    c.position.x += dt * 1.5;
    if (c.position.x > 520) c.position.x = -520;
  }
  // policija bljeska u prolazu
  {
    const d = Math.hypot(player.x - policeNpc.obj.position.x, player.z - policeNpc.obj.position.z);
    policeNpc.flashCooldown -= dt;
    if (d < 16 && policeNpc.flashCooldown <= 0) {
      policeNpc.flash = 2.5;
      policeNpc.flashCooldown = 12;
    }
    if (policeNpc.flash > 0) {
      policeNpc.flash -= dt;
      const on = Math.floor(clock.elapsedTime * 9) % 2 === 0;
      police.rl.visible = on;
      police.bl.visible = !on;
    } else {
      police.rl.visible = true;
      police.bl.visible = true;
    }
  }
  // vatrogasna intervencija (kratka sirena + brža vožnja)
  if (started) {
    fireTruck.nextIntervention -= dt;
    if (fireTruck.nextIntervention <= 0) {
      fireTruck.intervention = 7;
      fireTruck.nextIntervention = 30 + Math.random() * 25;
      sndSiren(600, 440, 4, 0.035);
    }
    if (fireTruck.intervention > 0) {
      fireTruck.intervention -= dt;
      fireTruck.speed = 11;
      fireTruck.beaconSpeed = 9;
    } else {
      fireTruck.speed = 7;
      fireTruck.beaconSpeed = 3;
    }
    // povremena kratka sirena hitne
    hornSirenTimer -= dt;
    if (hornSirenTimer <= 0) {
      hornSirenTimer = 45 + Math.random() * 30;
      sndSiren(750, 550, 3, 0.03);
    }
  }
  // zvjezdice: rotacija + skupljanje
  for (const s of stars) {
    if (s.taken) continue;
    s.mesh.rotation.y += dt * 2.2;
    s.mesh.position.y = s.base + Math.sin(clock.elapsedTime * 2 + s.x) * 0.25;
    const dx = player.x - s.x, dz = player.z - s.z;
    if (started && dx * dx + dz * dz < 9) {
      s.taken = true;
      s.mesh.visible = false;
      setStarCount(starCount + 1);
      sndDing();
    }
  }
  // zeleno parkirno mjesto pulsira
  greenPad.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.45;
  // "Bip-bip!" oblačić
  if (bipTimer > 0) {
    bipTimer -= dt;
    bipSprite.visible = bipTimer > 0;
    bipSprite.position.set(player.x + 0.9, terrainHeight(player.x, player.z) + 2.9, player.z);
  }
  // strelica-vodič
  if (!freeRide && missionIdx < MISSIONS.length && started) {
    guideArrow.visible = true;
    const m = MISSIONS[missionIdx];
    guideArrow.position.set(player.x, terrainHeight(player.x, player.z) + 3.3 + Math.sin(clock.elapsedTime * 3) * 0.2, player.z);
    guideArrow.rotation.y = Math.atan2(m.x - player.x, m.z - player.z);
  } else {
    guideArrow.visible = false;
  }
  if (started) updateMissions();
  if (bravoTimer > 0) {
    bravoTimer -= dt;
    if (bravoTimer <= 0) {
      bravoEl.classList.add('show');
      sndBravo();
      burstConfetti(player.x, terrainHeight(player.x, player.z) + 3, player.z);
    }
  }
  updateConfetti(dt);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// ---------------------------------------------------------------- start / fullscreen / resize
document.getElementById('btnPlay').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  initAudio();
  started = true;
  document.getElementById('start').style.display = 'none';
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
  sndHorn();
  bipTimer = 1.2;
});
// debug uvid za QA (broj trokuta itd.)
window.__yugoDebug = { renderer, player };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
