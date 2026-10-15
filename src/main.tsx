import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

// versão nova publicada: avisa o app (AvisoAtualizacao) em vez de recarregar no meio do trabalho
const atualizarSW = registerSW({
  immediate: true,
  onNeedRefresh() { window.dispatchEvent(new CustomEvent('gl-nova-versao', { detail: () => atualizarSW(true) })) },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
