/** Aparecer ao rolar e a barra de chamada fixa do celular. */
export function iniciarEfeitos() {
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue
      e.target.classList.add('in')
      io.unobserve(e.target)
    }
  }, { rootMargin: '0px 0px -8% 0px' })
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el))

  // barra do celular: aparece depois do topo e some quando a lista de espera está na tela
  const barra = document.querySelector<HTMLElement>('[data-barra]')
  const topo = document.querySelector('#topo .hero-cta')
  const lista = document.querySelector('#lista')
  if (!barra || !topo || !lista) return
  let passouTopo = false
  let naLista = false
  const atualizar = () => barra.classList.toggle('on', passouTopo && !naLista)
  new IntersectionObserver(([e]) => { passouTopo = !e.isIntersecting && e.boundingClientRect.top < 0; atualizar() }).observe(topo)
  new IntersectionObserver(([e]) => { naLista = e.isIntersecting; atualizar() }).observe(lista)
  window.addEventListener('lista-ok', () => { naLista = true; passouTopo = false; atualizar() })
}
