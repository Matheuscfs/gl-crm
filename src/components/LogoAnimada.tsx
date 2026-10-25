import { useEffect, useId, useRef } from 'react'
import { BRAND } from '../brand'

/*
 * Logo da Dra. sendo escrita: uma "pena" (máscara SVG) percorre o traçado do G e do L e
 * revela a imagem original por baixo — o desenho e as cores da logo não mudam. O texto
 * "Cirurgiã Dentista" aparece da esquerda para a direita e a borboleta, recortada da mesma
 * logo, chega voando e pousa no lugar dela, na ponta do L. Os PNGs (traços, texto e borboleta)
 * são camadas recortadas do logo-gl.png, sem mudar cor nem posição. Tudo em SMIL num só relógio, que
 * zera ao montar; com "reduzir movimento" a logo já aparece pronta.
 * Coordenadas no recorte da logo (354×232, sem a margem transparente do logo-gl.png).
 */

type P = readonly [number, number]

/** Percurso da pena no G: subida interna → laço do topo → curva externa → bojo → ponta →
 *  perna descendo até o laço de baixo → volta → arremate para a direita. */
const PENA_G: P[] = [
  [96, 107], [108, 98], [118, 89], [130, 77], [141, 65], [152, 50], [160, 38], [167, 25], [172, 15], [174, 10],
  [170, 7], [162, 8], [150, 14], [138, 21], [125, 30], [110, 40], [96, 52], [83, 63], [71, 75], [61, 88], [52, 100],
  [45, 112], [41, 124], [44, 133], [52, 137], [64, 137], [78, 135], [92, 131], [104, 127], [116, 121], [126, 115],
  [136, 106], [145, 96], [152, 87], [157, 79],
  [150, 88], [140, 101], [130, 113], [120, 124], [112, 133], [106, 140], [99, 149], [92, 158], [80, 170], [68, 183],
  [56, 196], [45, 208], [36, 217], [33, 221],
  [40, 216], [50, 205], [61, 193], [72, 181], [82, 170], [90, 160], [98, 150], [106, 140],
  [118, 135], [132, 129], [146, 125], [158, 122], [168, 122],
]
/** Percurso no L: de cima para baixo, curva e a linha longa para a direita. */
const PENA_L: P[] = [
  [283, 15], [270, 25], [255, 35], [240, 48], [226, 61], [212, 75], [198, 90], [186, 104], [175, 117], [165, 130],
  [157, 143], [151, 155], [150, 165], [153, 173], [160, 178], [172, 181], [190, 182], [210, 180], [230, 177],
  [250, 174], [270, 171], [285, 169], [297, 168],
]

/** Catmull-Rom → curvas cúbicas, para a pena andar sem quinas. */
function caminho(pts: P[]): string {
  const n = (v: number) => Math.round(v * 10) / 10
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const [p1, p2] = [pts[i], pts[i + 1]]
    const p3 = pts[i + 2] ?? p2
    d += `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`
  }
  return d
}
const D_G = caminho(PENA_G)
const D_L = caminho(PENA_L)

/** Corpo da borboleta (onde as asas se juntam) no recorte, e o canto do PNG dela. */
const CORPO = { x: 317, y: 137 }
const BORB = { x: 304, y: 100, w: 42, h: 49 }
/** Voo: entra pela esquerda, passa por cima do G, faz um S e desce para pousar. */
const VOO = `M-40 72C10 18 70 4 112 36S188 112 232 70S298 -6 332 40S350 118 ${CORPO.x} ${CORPO.y}`

// Relógio (s)
const T = {
  g: 0.15, gDur: 1.3,
  l: 1.2, lDur: 0.85,
  ponto: 2.05,
  texto: 1.55, textoDur: 0.75,
  voo: 0.9, vooDur: 2.1,
}
const pouso = T.voo + T.vooDur
const BATIDA = 0.18

function reduzMovimento() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function LogoAnimada({ className = '' }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const id = useId().replace(/:/g, '')
  const parada = reduzMovimento()

  // O relógio SMIL de um SVG embutido corre desde que a página abriu; zera ao montar.
  useEffect(() => {
    const el = svg.current
    if (!el || parada) return
    el.setCurrentTime(0)
    el.unpauseAnimations()
  }, [parada])

  const pena = (d: string, ini: number, dur: number) => (
    <path d={d} pathLength={1} fill="none" stroke="#fff" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="1 2" strokeDashoffset={1.05}>
      <animate attributeName="stroke-dashoffset" from="1.05" to="0" begin={`${ini}s`} dur={`${dur}s`} fill="freeze"
        calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.3 1" />
    </path>
  )

  return (
    <svg ref={svg} className={`logo-animada ${className}`.trim()} viewBox="0 0 354 232" role="img"
      aria-label={`${BRAND.dentist} · ${BRAND.subtitle.toLowerCase()}`}>
      {!parada && (
        <defs>
          <mask id={`pena-${id}`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="394" height="272">
            {pena(D_G, T.g, T.gDur)}
            {pena(D_L, T.l, T.lDur)}
            <circle cx="305" cy="171" r="0" fill="#fff">
              <animate attributeName="r" from="0" to="7" begin={`${T.ponto}s`} dur="0.22s" fill="freeze" />
            </circle>
          </mask>
          <mask id={`texto-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="354" height="232">
            <rect x="2" y="136" width="0" height="32" fill="#fff">
              <animate attributeName="width" from="0" to="314" begin={`${T.texto}s`} dur={`${T.textoDur}s`} fill="freeze"
                calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.6 1" />
            </rect>
          </mask>
        </defs>
      )}

      {/* Duas camadas da mesma logo: os traços (G, L e o ponto) seguem a pena; o texto
          "Cirurgiã Dentista" é escrito da esquerda para a direita, sem aparecer antes da hora. */}
      <image href="/logo-gl-tracos.png" width="354" height="232" mask={parada ? undefined : `url(#pena-${id})`} />
      <image href="/logo-gl-texto.png" width="354" height="232" mask={parada ? undefined : `url(#texto-${id})`} />

      {/* Borboleta: grupo do voo → inclinação → batida das asas (eixo no corpo). */}
      <g transform={parada ? `translate(${CORPO.x} ${CORPO.y})` : undefined} opacity={parada ? 1 : 0}>
        {!parada && (
          <>
            <set attributeName="opacity" to="1" begin={`${T.voo}s`} fill="freeze" />
            <animateMotion path={VOO} begin={`${T.voo}s`} dur={`${T.vooDur}s`} fill="freeze"
              calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.35 0 0.3 1" />
          </>
        )}
        <g>
          {!parada && (
            <animateTransform attributeName="transform" type="rotate" values="-14;10;-8;12;-6;0"
              begin={`${T.voo}s`} dur={`${T.vooDur}s`} fill="freeze" />
          )}
          <g>
            {!parada && (
              <>
                {/* voando: batidas rápidas */}
                <animateTransform attributeName="transform" type="scale" values="1 1;0.22 1;1 1"
                  begin={`${T.voo}s`} dur={`${BATIDA}s`} repeatCount={Math.round(T.vooDur / BATIDA)} />
                {/* pousou: duas batidas lentas e as asas abertas */}
                <animateTransform attributeName="transform" type="scale" values="1 1;0.4 1;1 1"
                  begin={`${pouso}s`} dur="0.55s" repeatCount="2" />
                {/* de tempos em tempos, um respiro das asas */}
                <animateTransform attributeName="transform" type="scale" values="1 1;1 1;0.45 1;1 1;0.55 1;1 1"
                  keyTimes="0;0.84;0.89;0.93;0.97;1" begin={`${pouso + 1.6}s`} dur="7s" repeatCount="indefinite" />
              </>
            )}
            <image href="/logo-gl-borboleta.png" x={BORB.x - CORPO.x} y={BORB.y - CORPO.y} width={BORB.w} height={BORB.h} />
          </g>
        </g>
      </g>
    </svg>
  )
}
