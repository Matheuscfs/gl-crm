import * as THREE from 'three'

/**
 * Modelagem dos dentes em 3D, só com Three.js (sem nada do app): coroa anatômica por tipo,
 * raízes e a curva da arcada. Usada pelo odontograma 3D da ficha e pela landing (landing/).
 */

export type Kind = 'incisor' | 'canine' | 'premolar' | 'molar'

export const kindOf = (num: number): Kind => {
  const d = num % 10
  const deciduo = Math.floor(num / 10) >= 5
  if (d === 1 || d === 2) return 'incisor'
  if (d === 3) return 'canine'
  if (deciduo) return 'molar' // molares decíduos (4 e 5)
  return d <= 5 ? 'premolar' : 'molar'
}
export const LARGURA: Record<Kind, number> = { incisor: 0.56, canine: 0.6, premolar: 0.64, molar: 0.86 }
export const ALTURA: Record<Kind, number> = { incisor: 0.92, canine: 1.0, premolar: 0.78, molar: 0.7 }

/* ---------- geometria dos dentes (coroa com o colo em y = 0, face vestibular em +z) ---------- */

export const PROF: Record<Kind, number> = { incisor: 0.42, canine: 0.5, premolar: 0.6, molar: 0.74 }
const lisa = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const gau = (x: number, z: number, sx: number, sz: number) => Math.exp(-((x * x) / (sx * sx) + (z * z) / (sz * sz)))

/** Coroa anatômica: esfera "quadrada" moldada por tipo (borda incisal, ponta do canino, cúspides e sulcos). */
export function crownGeometry(kind: Kind): THREE.BufferGeometry {
  const w = LARGURA[kind]
  const h = ALTURA[kind]
  const d = PROF[kind]
  const geo = new THREE.SphereGeometry(1, 56, 44)
  const pos = geo.attributes.position
  const e = kind === 'incisor' ? 0.62 : kind === 'canine' ? 0.78 : 0.6 // incisivo e posteriores mais "quadrados"
  const sq = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e)
  for (let i = 0; i < pos.count; i++) {
    let X = sq(pos.getX(i)) * (w / 2)
    let Y = (sq(pos.getY(i)) * 0.5 + 0.5) * h
    let Z = sq(pos.getZ(i)) * (d / 2)
    const t = Y / h
    if (kind === 'incisor') {
      X *= 0.56 + 0.44 * lisa(0, 0.5, t)                      // estreito no colo, largo na borda
      Z *= 1 - 0.68 * lisa(0.2, 1, t)                         // afina até a borda incisal
      if (Z > 0) Z += 0.035 * Math.sin(Math.PI * t) * (1 - (2 * X / w) ** 2) // vestibular convexa
      if (t > 0.88) Y = h * 0.88 + (Y - h * 0.88) * 0.25      // borda reta
      Y += 0.014 * h * Math.cos((6 * Math.PI * X) / w) * lisa(0.86, 1, t) // mamelões
    } else if (kind === 'canine') {
      X *= 0.64 + 0.36 * lisa(0, 0.55, t)
      Z *= 1 - 0.5 * lisa(0.3, 1, t)
      const ax = Math.min(1, Math.abs(X) / (w * 0.46))
      Y += h * 0.2 * lisa(0.55, 1, t) * Math.pow(1 - ax, 1.4) // ponta da cúspide
      if (Z > 0) Z += 0.04 * Math.sin(Math.PI * t) * (1 - ax)
    } else {
      X *= 0.74 + 0.26 * lisa(0, 0.4, t)
      Z *= 0.78 + 0.22 * lisa(0, 0.4, t)
      const topo = lisa(0.68, 1, t)
      if (topo > 0) {
        let c = 0
        if (kind === 'premolar') {
          c = 0.95 * gau(X, Z - d * 0.17, w * 0.24, d * 0.2) + 0.7 * gau(X, Z + d * 0.19, w * 0.22, d * 0.18)
          c -= 0.6 * gau(0, Z, 1, d * 0.07)                    // sulco central
        } else {
          c = 0.95 * gau(X - w * 0.22, Z - d * 0.19, w * 0.18, d * 0.17) + 0.85 * gau(X + w * 0.22, Z - d * 0.19, w * 0.18, d * 0.17)
            + 0.8 * gau(X - w * 0.22, Z + d * 0.2, w * 0.18, d * 0.17) + 0.7 * gau(X + w * 0.22, Z + d * 0.2, w * 0.18, d * 0.17)
          c -= 0.55 * gau(0, Z, 1, d * 0.06) + 0.45 * gau(X, 0, w * 0.05, 1) // sulcos em cruz
        }
        Y += topo * h * (0.17 * c - 0.07)
      }
    }
    pos.setXYZ(i, X, Y, Z)
  }
  geo.computeVertexNormals()
  return pintarEsmalte(geo, h)
}

/** Raiz cônica e levemente curva, do colo (y = 0) para dentro do osso (y negativo). */
function rootGeometry(len: number, r0: number, x: number, z: number, curva: number) {
  const g = new THREE.CylinderGeometry(r0 * 0.22, r0, len, 20, 12)
  g.translate(0, -len / 2, 0)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const k = -pos.getY(i) / len
    pos.setX(i, pos.getX(i) + x + curva * k * k)
    pos.setZ(i, pos.getZ(i) + z)
  }
  g.translate(0, 0.06, 0) // entra um pouco na coroa: sem fresta no colo
  g.computeVertexNormals()
  return g
}

export function rootGeometries(kind: Kind): THREE.BufferGeometry[] {
  const w = LARGURA[kind]
  const h = ALTURA[kind]
  const d = PROF[kind]
  if (kind === 'incisor') return [rootGeometry(h * 1.05, w * 0.34, 0, 0, -0.03)]
  if (kind === 'canine') return [rootGeometry(h * 1.3, w * 0.36, 0, 0, -0.04)]
  if (kind === 'premolar') return [rootGeometry(h * 1.15, w * 0.32, 0, 0, -0.03)]
  return [
    rootGeometry(h * 1.0, w * 0.2, -w * 0.22, d * 0.16, -0.07),
    rootGeometry(h * 0.95, w * 0.2, w * 0.22, d * 0.16, 0.07),
    rootGeometry(h * 1.1, w * 0.22, 0, -d * 0.2, 0),
  ]
}

const C_COLO = new THREE.Color(0xe9d9bd)
const C_MEIO = new THREE.Color(0xfbf8f2)
const C_PONTA = new THREE.Color(0xe2ebf3)
function pintarEsmalte(geo: THREE.BufferGeometry, h: number) {
  const pos = geo.attributes.position
  const cores = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / h))
    if (t < 0.5) c.copy(C_COLO).lerp(C_MEIO, t / 0.5)
    else c.copy(C_MEIO).lerp(C_PONTA, Math.min(1, (t - 0.5) / 0.5) * 0.8)
    cores.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  return geo
}

/* ---------- arcada ---------- */

/** Curva em "U" da arcada (frente em z = 0, fundo para trás). */
export function archCurve(raioX: number, raioZ: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const t = -1 + (2 * i) / 40
    const a = t * (Math.PI * 0.52)
    pts.push(new THREE.Vector3(Math.sin(a) * raioX, 0, (Math.cos(a) - 1) * raioZ))
  }
  return new THREE.CatmullRomCurve3(pts)
}
