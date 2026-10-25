/**
 * Nome e textos da marca num lugar só. O nome é PROVISÓRIO: trocar aqui troca na página
 * inteira (título, menu, rodapé, formulário e metadados).
 */
export const SITE = {
  marca: 'Aura+',
  sufixo: 'Odonto',
  get nome() { return `${this.marca} ${this.sufixo}` },
  titulo: 'CRM para consultório odontológico',
  descricao:
    'O CRM feito dentro de um consultório de verdade: agenda que confirma pelo WhatsApp, odontograma 3D, prontuário com histórico, PIX, recibos e Receita Saúde. No computador, no tablet e no celular.',
  ano: 2026,
}
