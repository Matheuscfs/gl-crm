import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { TOOTH, type ToothItem, type ToothState } from '../../data'

/**
 * Odontograma em 3D: as duas arcadas montadas em curva, com dentes modelados em código
 * (incisivo, canino, pré-molar e molar), gengiva, rotação com o dedo/mouse e seleção por toque.
 * Carregado sob demanda (React.lazy) para o Three.js não pesar nas outras telas.
 */

type Kind = 'incisor' | 'canine' | 'premolar' | 'molar'
type Vista = 'frente' | 'superior' | 'inferior'

/** Cor de cada condição no 3D (as mesmas da legenda do odontograma). */
const COR: Record<ToothState, number> = {
  higido: 0xf6f1e7,
  cariado: 0xd93a3f,     // a tratar: vermelho
  restaurado: 0x3b82f6,  // tratado: azul
  selante: 0x14b8a6,
  ausente: 0x9d99aa,
  erupcao: 0xef9ec4,
  extraido: 0x3b82f6,    // extração feita: X azul
}

const kindOf = (num: number): Kind => {
  const d = num % 10
  const deciduo = Math.floor(num / 10) >= 5
  if (d === 1 || d === 2) return 'incisor'
  if (d === 3) return 'canine'
  if (deciduo) return 'molar' // molares decíduos (4 e 5)
  return d <= 5 ? 'premolar' : 'molar'
}
const LARGURA: Record<Kind, number> = { incisor: 0.56, canine: 0.6, premolar: 0.64, molar: 0.86 }
const ALTURA: Record<Kind, number> = { incisor: 0.92, canine: 1.0, premolar: 0.78, molar: 0.7 }

/* ---------- geometria dos dentes (coroa com o colo em y = 0, face vestibular em +z) ---------- */

const PROF: Record<Kind, number> = { incisor: 0.42, canine: 0.5, premolar: 0.6, molar: 0.74 }
const lisa = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const gau = (x: number, z: number, sx: number, sz: number) => Math.exp(-((x * x) / (sx * sx) + (z * z) / (sz * sz)))

/** Coroa anatômica: esfera "quadrada" moldada por tipo (borda incisal, ponta do canino, cúspides e sulcos). */
function crownGeometry(kind: Kind): THREE.BufferGeometry {
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

function rootGeometries(kind: Kind): THREE.BufferGeometry[] {
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
function archCurve(raioX: number, raioZ: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const t = -1 + (2 * i) / 40
    const a = t * (Math.PI * 0.52)
    pts.push(new THREE.Vector3(Math.sin(a) * raioX, 0, (Math.cos(a) - 1) * raioZ))
  }
  return new THREE.CatmullRomCurve3(pts)
}

interface Dente { group: THREE.Group; crown: THREE.MeshPhysicalMaterial[]; label: HTMLDivElement; num: number }

export default function Odonto3D({ upper, lower, selected, onSelect, isDim }: {
  /** Dentes da arcada superior, da esquerda para a direita de quem olha (como no 2D). */
  upper: ToothItem[]
  lower: ToothItem[]
  selected: number
  onSelect: (num: number) => void
  isDim: (t: ToothItem) => boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ctx = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls
    upperGroup: THREE.Group; lowerGroup: THREE.Group; teeth: Map<number, Dente>
    goTo: (v: Vista) => void; focar: (num: number) => void; mostrarRaizes: (on: boolean) => void
    rootMat: THREE.MeshPhysicalMaterial; raizes: boolean
  } | null>(null)
  const [vista, setVista] = useState<Vista>('frente')
  const [erro, setErro] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [raizes, setRaizes] = useState(false)
  const primeiraSel = useRef(true)
  useEffect(() => {
    if (primeiraSel.current) { primeiraSel.current = false; return }
    ctx.current?.focar(selected)
  }, [selected])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  /* cena, câmera, luz e controles: uma vez */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setErro(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const labels = new CSS2DRenderer()
    labels.domElement.className = 'o3d-labels'
    host.appendChild(labels.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = new RoomEnvironment()
    scene.environment = pmrem.fromScene(env, 0.04).texture
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c8e8, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(3, 6, 8)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xe9d8ff, 0.6)
    rim.position.set(-6, 2, -6)
    scene.add(rim)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 6
    controls.maxDistance = 18
    controls.target.set(0, 0, -1.6)

    // gengivas: tubo achatado ao longo da curva de cada arcada
    const gumMat = new THREE.MeshPhysicalMaterial({ color: 0xe7a3b4, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color(0xffd6e2) })
    const makeGum = (y: number) => {
      const curve = archCurve(3.05, 3.5)
      const geo = new THREE.TubeGeometry(curve, 120, 0.42, 18, false)
      geo.scale(1, 0.62, 1)
      const m = new THREE.Mesh(geo, gumMat)
      m.position.y = y
      return m
    }
    const upperGroup = new THREE.Group()
    const lowerGroup = new THREE.Group()
    upperGroup.position.y = 0.95
    lowerGroup.position.y = -0.95
    upperGroup.add(makeGum(0.18))
    lowerGroup.add(makeGum(-0.18))
    scene.add(upperGroup, lowerGroup)

    const teeth = new Map<number, Dente>()

    /* vistas prontas, com transição suave da câmera */
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let anim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number } | null = null
    const VISTAS: Record<Vista, { pos: [number, number, number]; target: [number, number, number] }> = {
      frente: { pos: [0, 2.9, 12.2], target: [0, -0.1, -1.7] },
      superior: { pos: [0, -8.2, 1.2], target: [0, 0.6, -1.9] },
      inferior: { pos: [0, 8.2, 1.2], target: [0, -0.6, -1.9] },
    }
    // etiquetas HTML não herdam a visibilidade do grupo: esconde junto a da arcada oculta
    const sincronizarEtiquetas = () => {
      for (const g of [upperGroup, lowerGroup]) g.traverse((o) => { if (o instanceof CSS2DObject) o.visible = g.visible })
    }
    const goTo = (v: Vista) => {
      upperGroup.visible = v !== 'inferior'
      lowerGroup.visible = v !== 'superior'
      sincronizarEtiquetas()
      const cfg = VISTAS[v]
      const to = new THREE.Vector3(...cfg.pos)
      const tTo = new THREE.Vector3(...cfg.target)
      if (reduz) { camera.position.copy(to); controls.target.copy(tTo); return }
      anim = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, t0: performance.now() }
    }
    // entrada: a câmera chega de mais longe
    camera.position.set(7.5, 4.2, 12.5)
    goTo('frente')

    /* tamanho acompanha o cartão */
    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      renderer.setSize(w, h)
      labels.setSize(w, h)
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    /* toque/clique: seleciona; arrastar: só gira */
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const pick = (e: PointerEvent): number | null => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects([upperGroup, lowerGroup], true).filter((h) => h.object.visible && h.object.userData.num)
      return hits.length ? (hits[0].object.userData.num as number) : null
    }
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const n = pick(e)
        if (n) onSelectRef.current(n)
      }
      down = null
    }
    const onMove = (e: PointerEvent) => {
      if (down) return
      const n = pick(e)
      renderer.domElement.style.cursor = n ? 'pointer' : 'grab'
      setHover(n)
    }
    const onLeave = () => setHover(null)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerleave', onLeave)

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (anim) {
        const k = Math.min(1, (performance.now() - anim.t0) / 900)
        const e = 1 - Math.pow(1 - k, 3)
        camera.position.lerpVectors(anim.from, anim.to, e)
        controls.target.lerpVectors(anim.tFrom, anim.tTo, e)
        if (k >= 1) anim = null
      }
      controls.update()
      renderer.render(scene, camera)
      labels.render(scene, camera)
    }
    tick()

    const rootMat = new THREE.MeshPhysicalMaterial({ color: 0xead6b4, roughness: 0.55, clearcoat: 0.3, sheen: 0.2 })
    const mostrarRaizes = (on: boolean) => {
      if (ctx.current) ctx.current.raizes = on
      gumMat.transparent = on
      gumMat.opacity = on ? 0.26 : 1
      gumMat.depthWrite = !on
      gumMat.needsUpdate = true
      for (const g of [upperGroup, lowerGroup]) g.traverse((o) => { if (o.userData.raiz) o.visible = on })
    }
    const focar = (num: number) => {
      const d = teeth.get(num)
      if (!d) return
      const p = new THREE.Vector3()
      d.group.getWorldPosition(p)
      // aproxima mantendo o ângulo atual, mirando no dente
      const dir = camera.position.clone().sub(controls.target).normalize()
      const alvo = p.clone().lerp(controls.target, 0.25)
      if (reduz) { controls.target.copy(alvo); camera.position.copy(alvo.clone().addScaledVector(dir, 7.4)); return }
      anim = { from: camera.position.clone(), to: alvo.clone().addScaledVector(dir, 7.4), tFrom: controls.target.clone(), tTo: alvo, t0: performance.now() }
    }
    ctx.current = { scene, camera, controls, upperGroup, lowerGroup, teeth, goTo, focar, mostrarRaizes, rootMat, raizes: false }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose()
      })
      scene.environment?.dispose()
      pmrem.dispose()
      env.dispose()
      renderer.dispose()
      host.innerHTML = ''
      ctx.current = null
    }
  }, [])

  /* dentes: refeitos quando a condição de algum muda */
  const chave = [...upper, ...lower].map((t) => `${t.num}:${t.state}`).join(',')
  useEffect(() => {
    const c = ctx.current
    if (!c) return
    c.teeth.forEach((d) => { d.group.removeFromParent(); d.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.() }) })
    c.teeth.clear()

    const montar = (lista: ToothItem[], parent: THREE.Group, superior: boolean) => {
      const curve = archCurve(3.05, 3.5)
      const len = curve.getLength()
      const gap = 0.05
      const total = lista.reduce((s, t) => s + LARGURA[kindOf(t.num)] + gap, -gap)
      let s = (len - total) / 2
      lista.forEach((t) => {
        const kind = kindOf(t.num)
        const w = LARGURA[kind]
        const u = (s + w / 2) / len
        s += w + gap
        const p = curve.getPointAt(u)
        const tan = curve.getTangentAt(u)
        const g = new THREE.Group()
        g.position.set(p.x, 0, p.z)
        g.rotation.y = -Math.atan2(tan.z, tan.x)
        const inner = new THREE.Group()
        if (superior) inner.rotation.z = Math.PI // coroa para baixo
        g.add(inner)

        const estado = t.state
        const base = new THREE.MeshPhysicalMaterial({
          color: estado === 'higido' || estado === 'cariado' || estado === 'selante' ? 0xffffff : new THREE.Color(0xffffff).lerp(new THREE.Color(COR[estado]), 0.4),
          vertexColors: true,
          roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 0.9, sheen: 0.3, sheenColor: new THREE.Color(0xfff6e8),
          transparent: estado === 'ausente', opacity: estado === 'ausente' ? 0.18 : 1, depthWrite: estado !== 'ausente',
        })
        base.userData.op = base.opacity
        const crown = [base]
        if (estado !== 'extraido') {
          const mesh = new THREE.Mesh(crownGeometry(kind), base)
          mesh.userData.num = t.num
          inner.add(mesh)
          if (estado !== 'erupcao') {
            for (const rg of rootGeometries(kind)) {
              const root = new THREE.Mesh(rg, c.rootMat)
              root.userData.num = t.num
              root.userData.raiz = true
              root.visible = c.raizes
              inner.add(root)
            }
          }
          // em erupção: a coroa ainda está metade dentro da gengiva
          if (estado === 'erupcao') inner.position.y = superior ? 0.42 : -0.42
          const h = ALTURA[kind]
          // marca da condição: lesão (cárie), restauração ou selante sobre a face de mastigar/borda
          if (estado === 'cariado' || estado === 'restaurado' || estado === 'selante') {
            const mm = new THREE.MeshPhysicalMaterial({
              color: COR[estado], roughness: estado === 'selante' ? 0.15 : 0.5, clearcoat: estado === 'selante' ? 1 : 0.2,
              transparent: estado === 'selante', opacity: estado === 'selante' ? 0.75 : 1, emissive: COR[estado], emissiveIntensity: 0.12,
            })
            mm.userData.op = mm.opacity
            crown.push(mm)
            const anterior = kind === 'incisor' || kind === 'canine'
            const spot = new THREE.Mesh(new THREE.SphereGeometry(estado === 'selante' ? w * 0.4 : estado === 'cariado' ? w * 0.2 : w * 0.26, 28, 18), mm)
            spot.scale.set(1, estado === 'selante' ? 0.2 : 0.45, estado === 'selante' ? 1 : 0.7)
            spot.position.set(estado === 'cariado' ? w * 0.1 : 0, anterior ? h * 0.6 : h * 0.9, anterior ? PROF[kind] * 0.32 : 0)
            spot.userData.num = t.num
            inner.add(spot)
          }
        } else {
          // extraído: "X" vermelho no lugar do dente
          const xm = new THREE.MeshPhysicalMaterial({ color: COR.extraido, roughness: 0.4, emissive: COR.extraido, emissiveIntensity: 0.25 })
          xm.userData.op = 1
          crown.push(xm)
          for (const ang of [Math.PI / 4, -Math.PI / 4]) {
            const bar = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.11, 0.11, 3, 0.05), xm)
            bar.rotation.z = ang
            bar.position.y = 0.42
            bar.userData.num = t.num
            inner.add(bar)
          }
        }

        // número do dente (etiqueta HTML que acompanha a câmera)
        const el = document.createElement('div')
        el.className = 'o3d-num'
        el.textContent = String(t.num)
        el.dataset.estado = TOOTH[t.state].label
        const lbl = new CSS2DObject(el)
        lbl.visible = parent.visible
        lbl.position.set(0, superior ? 0.78 : -0.78, 0.25)
        g.add(lbl)

        parent.add(g)
        c.teeth.set(t.num, { group: g, crown, label: el, num: t.num })
      })
    }
    montar(upper, c.upperGroup, true)
    montar(lower, c.lowerGroup, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  /* seleção, foco do mouse e filtro: só materiais e etiquetas */
  const dimKey = [...upper, ...lower].map((t) => (isDim(t) ? 1 : 0)).join('')
  useEffect(() => {
    const c = ctx.current
    if (!c) return
    const todos = [...upper, ...lower]
    c.teeth.forEach((d) => {
      const t = todos.find((x) => x.num === d.num)
      const dim = t ? isDim(t) : false
      const sel = d.num === selected
      const hov = d.num === hover
      const base = d.crown[0]
      base.emissive.set(sel ? 0x8b5cf6 : 0x000000)
      base.emissiveIntensity = sel ? 0.28 : hov ? 0.12 : 0
      if (hov && !sel) base.emissive.set(0x8b5cf6)
      d.crown.forEach((m) => {
        // opacidade original guardada na criação (selante é translúcido, ausente quase some)
        const op = (m.userData.op as number | undefined) ?? 1
        m.opacity = dim ? Math.min(op, 0.16) : op
        m.transparent = m.opacity < 1
        m.depthWrite = m.opacity >= 0.5
        m.needsUpdate = true
      })
      d.group.scale.setScalar(sel ? 1.08 : hov ? 1.04 : 1)
      d.label.dataset.sel = sel ? '1' : ''
      d.label.dataset.hov = hov || sel ? '1' : ''
      d.label.dataset.dim = dim ? '1' : ''
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, hover, dimKey, chave])

  if (erro) return <p className="empty-note">Este aparelho não conseguiu abrir a visualização 3D. Use a vista 2D.</p>

  return (
    <div className="o3d">
      <div ref={hostRef} className="o3d-stage" role="img" aria-label={`Odontograma em 3D. Dente selecionado: ${selected}. Arraste para girar e toque num dente para selecionar.`} />
      <div className="o3d-views seg-sm" role="group" aria-label="Vista">
        {([['frente', 'Frente'], ['superior', 'Arcada superior'], ['inferior', 'Arcada inferior']] as [Vista, string][]).map(([v, rot]) => (
          <button key={v} aria-pressed={vista === v} onClick={() => { setVista(v); ctx.current?.goTo(v) }}>{rot}</button>
        ))}
        <button aria-pressed={raizes} onClick={() => { setRaizes(!raizes); ctx.current?.mostrarRaizes(!raizes) }}>Raízes</button>
      </div>
      <p className="o3d-hint">Arraste para girar · role ou pince para aproximar · toque num dente para selecionar</p>
    </div>
  )
}
