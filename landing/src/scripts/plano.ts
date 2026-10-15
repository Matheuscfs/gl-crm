import type { Estado, Hero3D } from './hero3d'

/**
 * Topo da página: os achados do exame viram itens do plano de tratamento, pelo 3D ou pelos
 * botões (que também servem no teclado e quando o aparelho não abre WebGL).
 */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const ACHADOS: Record<number, { achado: string; proc: string; valor: number }> = {
  36: { achado: 'Cárie oclusal', proc: 'Restauração em resina', valor: 280 },
  46: { achado: 'Cárie oclusal', proc: 'Restauração em resina', valor: 280 },
  24: { achado: 'Cárie na face vestibular', proc: 'Restauração em resina', valor: 220 },
}
const ESTADOS: Record<number, Estado> = { 36: 'cariado', 46: 'cariado', 24: 'cariado', 16: 'restaurado', 47: 'restaurado' }

const TIPO = ['', 'incisivo central', 'incisivo lateral', 'canino', '1º pré-molar', '2º pré-molar', '1º molar', '2º molar', '3º molar']
const LADO = ['', 'superior direito', 'superior esquerdo', 'inferior esquerdo', 'inferior direito']
const nomeDente = (n: number) => `${TIPO[n % 10]} ${LADO[Math.floor(n / 10)]}`
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function rotulo(n: number): { texto: string; estado: Estado } {
  const estado = ESTADOS[n] ?? 'higido'
  const nome = nomeDente(n)
  if (estado === 'cariado') return { texto: `${ACHADOS[n].achado} · ${nome}`, estado }
  if (estado === 'restaurado') return { texto: `Restaurado · ${nome}`, estado }
  return { texto: maiuscula(nome), estado }
}

export function iniciarPlano() {
  const host = document.querySelector<HTMLElement>('[data-o3d]')!
  const tag = document.querySelector<HTMLElement>('[data-tag]')!
  const grupoAchados = document.querySelector<HTMLElement>('[data-achados]')!
  const botoes = [...grupoAchados.querySelectorAll<HTMLButtonElement>('[data-dente]')]
  const lista = document.querySelector<HTMLUListElement>('[data-itens]')!
  const vazio = lista.querySelector<HTMLLIElement>('.plano-vazio')!
  const total = document.querySelector<HTMLElement>('[data-total]')!
  const parc = document.querySelector<HTMLElement>('[data-parc]')!
  const enviar = document.querySelector<HTMLButtonElement>('[data-enviar]')!
  const status = document.querySelector<HTMLElement>('[data-status]')!

  const sel: number[] = []
  let hero: Hero3D | null = null
  let timers: number[] = []

  const limparEnvio = () => {
    timers.forEach(clearTimeout)
    timers = []
    status.textContent = ''
    status.classList.remove('ok')
  }

  const render = () => {
    for (const b of botoes) b.setAttribute('aria-pressed', String(sel.includes(Number(b.dataset.dente))))
    // tira os que saíram e acrescenta os novos (sem reanimar os que ficaram)
    for (const li of [...lista.querySelectorAll<HTMLLIElement>('.plano-item')]) {
      if (!sel.includes(Number(li.dataset.n))) li.remove()
    }
    for (const n of sel) {
      if (lista.querySelector(`[data-n="${n}"]`)) continue
      const a = ACHADOS[n]
      const li = document.createElement('li')
      li.className = 'plano-item'
      li.dataset.n = String(n)
      li.innerHTML = `<b>${n}</b><span>${a.proc}</span><em>${brl.format(a.valor)}</em>`
      lista.appendChild(li)
    }
    vazio.hidden = sel.length > 0
    const soma = sel.reduce((s, n) => s + ACHADOS[n].valor, 0)
    total.textContent = brl.format(soma)
    parc.textContent = soma ? `ou 3x de ${brl.format(soma / 3)} no cartão` : ''
    enviar.disabled = sel.length === 0
    limparEnvio()
  }

  const alternar = (n: number) => {
    if (!ACHADOS[n]) return
    const i = sel.indexOf(n)
    if (i >= 0) sel.splice(i, 1)
    else sel.push(n)
    hero?.marcar(n, i < 0)
    grupoAchados.classList.remove('dica')
    render()
  }

  for (const b of botoes) {
    const n = Number(b.dataset.dente)
    b.addEventListener('click', () => alternar(n))
    b.addEventListener('pointerenter', () => hero?.destacar(n))
    b.addEventListener('pointerleave', () => hero?.destacar(null))
    b.addEventListener('focus', () => hero?.destacar(n))
    b.addEventListener('blur', () => hero?.destacar(null))
  }

  enviar.addEventListener('click', () => {
    limparEnvio()
    enviar.disabled = true
    status.textContent = 'Enviando para Marina pelo WhatsApp…'
    timers.push(window.setTimeout(() => {
      const h = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      status.textContent = `✓ Enviado para Marina às ${h}`
      status.classList.add('ok')
      enviar.disabled = false
    }, 1100))
  })

  render()

  // o 3D (Three.js) só baixa quando o palco aparece e o navegador está livre
  const carregar = async () => {
    const sem3d = () => host.classList.remove('carregando')
    try {
      const { iniciarHero3D } = await import('./hero3d')
      hero = iniciarHero3D(host, ESTADOS, {
        tag,
        rotulo,
        aoClicar: alternar,
        aoPronto: () => host.classList.replace('carregando', 'pronto'),
      })
      if (!hero) return sem3d()
      for (const n of sel) hero.marcar(n, true)
    } catch {
      sem3d()
    }
  }
  const quandoLivre = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 1500 }) : window.setTimeout(fn, 200))
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return
    io.disconnect()
    quandoLivre(carregar)
  }, { rootMargin: '300px' })
  io.observe(host)
}
