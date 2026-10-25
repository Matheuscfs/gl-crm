import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ALTURA, LARGURA, PROF, archCurve, crownGeometry, kindOf, type Kind } from '../../../src/lib/dente3d'

/**
 * Arcadas em 3D do topo da página, com a mesma modelagem dos dentes do odontograma do app.
 * Diferente do app: sem OrbitControls (no celular a página precisa rolar por cima do 3D) —
 * o conjunto balança devagar, segue o mouse de leve e cada dente responde ao toque.
 */

export type Estado = 'higido' | 'cariado' | 'restaurado'

/** Da esquerda para a direita de quem olha, como no odontograma 2D. */
const SUP = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
const INF = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]

const COR_CARIE = 0xd93a3f
const COR_RESTAURACAO = 0x3b82f6
const VIOLETA = 0x8b5cf6
const ABERTURA = 1.05 // meia distância entre as arcadas

interface Dente {
  num: number
  grupo: THREE.Group
  esmalte: THREE.MeshPhysicalMaterial
  mancha?: THREE.MeshPhysicalMaterial
  estado: Estado
  escala: number
}

export interface Hero3D {
  marcar(num: number, on: boolean): void
  destacar(num: number | null): void
}

export function iniciarHero3D(
  host: HTMLElement,
  estados: Record<number, Estado>,
  cb: {
    tag: HTMLElement
    rotulo: (num: number) => { texto: string; estado: Estado }
    aoClicar: (num: number) => void
    aoPronto: () => void
  },
): Hero3D | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c8e8, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(3, 6, 8)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xe9d8ff, 0.7)
  rim.position.set(-6, 2, -6)
  scene.add(rim)

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

  // pivô no centro da arcada: o balanço gira em torno do meio, não da frente
  const pivo = new THREE.Group()
  const conjunto = new THREE.Group()
  conjunto.position.z = 1.75
  pivo.add(conjunto)
  scene.add(pivo)

  const gumMat = new THREE.MeshPhysicalMaterial({ color: 0xe7a3b4, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color(0xffd6e2) })
  const curva = archCurve(3.05, 3.5)
  const gengiva = (y: number) => {
    const geo = new THREE.TubeGeometry(curva, 120, 0.38, 18, false)
    geo.scale(1, 0.58, 1)
    const m = new THREE.Mesh(geo, gumMat)
    m.position.y = y
    return m
  }
  const sup = new THREE.Group()
  const inf = new THREE.Group()
  sup.add(gengiva(0.18))
  inf.add(gengiva(-0.18))
  conjunto.add(sup, inf)

  const coroas = new Map<Kind, THREE.BufferGeometry>()
  const coroa = (k: Kind) => {
    let g = coroas.get(k)
    if (!g) { g = crownGeometry(k); coroas.set(k, g) }
    return g
  }

  const dentes = new Map<number, Dente>()
  const montar = (nums: number[], parent: THREE.Group, superior: boolean) => {
    const len = curva.getLength()
    const gap = 0.05
    const natural = nums.reduce((s, n) => s + LARGURA[kindOf(n)] + gap, -gap)
    const k = Math.min(1, (len * 0.97) / natural)
    let s = (len - natural * k) / 2
    for (const num of nums) {
      const kind = kindOf(num)
      const w = LARGURA[kind]
      const h = ALTURA[kind]
      const d = PROF[kind]
      const u = Math.min(1, Math.max(0, (s + (w * k) / 2) / len))
      s += w * k + gap * k
      const p = curva.getPointAt(u)
      const tan = curva.getTangentAt(u)
      const grupo = new THREE.Group()
      grupo.position.set(p.x, 0, p.z)
      grupo.rotation.y = -Math.atan2(tan.z, tan.x)
      const inner = new THREE.Group()
      if (superior) inner.rotation.z = Math.PI // coroa para baixo
      if (k < 1) inner.scale.setScalar(k)
      grupo.add(inner)

      const estado = estados[num] ?? 'higido'
      const esmalte = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, vertexColors: true,
        roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 0.9, sheen: 0.3, sheenColor: new THREE.Color(0xfff6e8),
      })
      const corpo = new THREE.Mesh(coroa(kind), esmalte)
      corpo.userData.num = num
      inner.add(corpo)

      let mancha: THREE.MeshPhysicalMaterial | undefined
      if (estado !== 'higido') {
        const cor = estado === 'cariado' ? COR_CARIE : COR_RESTAURACAO
        mancha = new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.45, clearcoat: 0.3, emissive: cor, emissiveIntensity: 0.15 })
        const posterior = kind === 'premolar' || kind === 'molar'
        const r = estado === 'cariado' ? w * 0.21 : w * 0.27
        const spot = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), mancha)
        if (posterior && !superior) {
          // inferior: na borda da face de mastigar com a vestibular, que a câmera vê de frente e de cima
          spot.scale.set(1, 0.6, 0.62)
          spot.position.set(estado === 'cariado' ? w * 0.06 : 0, h * 0.86, d * 0.24)
        } else {
          // superior e anteriores: na face vestibular
          spot.scale.set(1, 0.8, 0.38)
          spot.position.set(0, h * 0.5, d * 0.42)
        }
        spot.userData.num = num
        inner.add(spot)
      }
      parent.add(grupo)
      dentes.set(num, { num, grupo, esmalte, mancha, estado, escala: 1 })
    }
  }
  montar(SUP, sup, true)
  montar(INF, inf, false)

  /* ---------- estado da interação ---------- */
  const marcados = new Set<number>()
  let hover: number | null = null
  let destaque: number | null = null
  let tagNum: number | null = null
  let tagAte = 0

  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const t0 = performance.now()
  const INTRO = reduz ? 0 : 1700

  /* ---------- enquadramento: a arcada ocupa uma fração da largura conforme o palco ---------- */
  let dist = 12
  const ELEV = THREE.MathUtils.degToRad(11)
  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
    const tanMeio = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const fracao = camera.aspect > 1.6 ? 0.46 : camera.aspect > 1.15 ? 0.7 : 0.9
    const dW = 6.6 / fracao / 2 / (tanMeio * camera.aspect)
    const dH = 5.4 / 2 / tanMeio
    dist = Math.max(dW, dH)
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist)
    camera.lookAt(0, -0.1, 0)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  /* ---------- ponteiro: leve parallax na página toda; toque/clique nos dentes ---------- */
  const alvo = { x: 0, y: 0 }
  const atual = { x: 0, y: 0 }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    alvo.x = (e.clientX / window.innerWidth - 0.5) * 2
    alvo.y = (e.clientY / window.innerHeight - 0.5) * 2
  }, { passive: true })

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pick = (e: PointerEvent): number | null => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObject(conjunto, true).find((h) => h.object.userData.num)
    return hit ? (hit.object.userData.num as number) : null
  }
  const cv = renderer.domElement
  let down: { x: number; y: number } | null = null
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
  cv.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
      const n = pick(e)
      if (n) {
        cb.aoClicar(n)
        mostrarTag(n, performance.now() + 2600)
      }
    }
    down = null
  })
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    const n = pick(e)
    cv.style.cursor = n ? 'pointer' : 'default'
    if (n !== hover) {
      hover = n
      if (n) mostrarTag(n, Infinity)
      else if (tagAte === Infinity) tagAte = 0
    }
  })
  // com o mouse em cima, o balanço para: fica fácil acertar o dente
  let sobre = false
  cv.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sobre = true })
  cv.addEventListener('pointerleave', () => { sobre = false; hover = null; if (tagAte === Infinity) tagAte = 0 })

  const mostrarTag = (n: number, ate: number) => {
    if (n !== tagNum) {
      const { texto, estado } = cb.rotulo(n)
      cb.tag.querySelector('b')!.textContent = String(n)
      cb.tag.querySelector('span')!.textContent = texto
      cb.tag.dataset.estado = estado
    }
    tagNum = n
    tagAte = ate
  }

  /* ---------- quadro a quadro ---------- */
  const v = new THREE.Vector3()
  const box = new THREE.Box3()
  let visivel = true
  let raf = 0
  let fase = 0
  let antes = performance.now()
  let pronto = false
  const io = new IntersectionObserver((es) => {
    visivel = es.some((e) => e.isIntersecting)
    if (visivel && !raf) raf = requestAnimationFrame(tick)
  })
  io.observe(host)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visivel && !raf) raf = requestAnimationFrame(tick)
  })

  function tick(now: number) {
    raf = 0
    if (!visivel || document.hidden) return
    raf = requestAnimationFrame(tick)
    const t = (now - t0) / 1000
    const dt = Math.min(0.1, (now - antes) / 1000)
    antes = now
    if (!sobre) fase += dt * 0.32

    // entrada: as arcadas se aproximam e o conjunto gira até a frente
    const k = INTRO ? Math.min(1, (now - t0) / INTRO) : 1
    const e = 1 - Math.pow(1 - k, 4)
    sup.position.y = ABERTURA + (1 - e) * 1.7
    inf.position.y = -ABERTURA - (1 - e) * 1.7

    atual.x += (alvo.x - atual.x) * 0.05
    atual.y += (alvo.y - atual.y) * 0.05
    const balanco = reduz ? 0 : Math.sin(fase) * 0.36
    pivo.rotation.y = (1 - e) * -1.1 + balanco + atual.x * 0.2
    pivo.rotation.x = 0.04 + atual.y * 0.06

    for (const d of dentes.values()) {
      const sel = marcados.has(d.num)
      const foco = d.num === hover || d.num === destaque
      d.esmalte.emissive.setHex(sel || foco ? VIOLETA : 0x000000)
      d.esmalte.emissiveIntensity = sel ? 0.42 : foco ? 0.18 : 0
      const escAlvo = sel ? 1.08 : foco ? 1.04 : 1
      d.escala += (escAlvo - d.escala) * 0.18
      d.grupo.scale.setScalar(d.escala)
      if (d.mancha && d.estado === 'cariado') {
        // cárie fora do plano "chama" o toque; no plano, fica violeta (tratamento planejado)
        d.mancha.color.setHex(sel ? VIOLETA : COR_CARIE)
        d.mancha.emissive.setHex(sel ? VIOLETA : COR_CARIE)
        d.mancha.emissiveIntensity = sel ? 0.5 : 0.15 + (reduz ? 0.15 : 0.32 * (0.5 + 0.5 * Math.sin(t * 3.2)))
      }
    }

    renderer.render(scene, camera)

    // etiqueta acompanha o dente, por fora da boca: acima do superior, abaixo do inferior
    if (tagNum && now < tagAte) {
      const d = dentes.get(tagNum)!
      box.setFromObject(d.grupo)
      const superior = Math.floor(tagNum / 10) <= 2
      v.set((box.min.x + box.max.x) / 2, superior ? box.max.y + 0.3 : box.min.y - 0.3, (box.min.z + box.max.z) / 2)
      v.project(camera)
      const x = (v.x * 0.5 + 0.5) * host.clientWidth
      const y = (-v.y * 0.5 + 0.5) * host.clientHeight
      const ty = superior ? y - cb.tag.offsetHeight : y
      cb.tag.style.transform = `translate(${Math.round(x - cb.tag.offsetWidth / 2)}px, ${Math.round(ty)}px)`
      cb.tag.classList.add('on')
    } else {
      cb.tag.classList.remove('on')
    }

    if (!pronto) { pronto = true; cb.aoPronto() }
  }
  raf = requestAnimationFrame(tick)

  return {
    marcar(num, on) { if (on) marcados.add(num); else marcados.delete(num) },
    destacar(num) {
      destaque = num
      if (num) mostrarTag(num, Infinity)
      else if (tagAte === Infinity && !hover) tagAte = 0
    },
  }
}
