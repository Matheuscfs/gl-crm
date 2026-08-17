import type { CSSProperties, ReactNode } from 'react'
import { usePhotoSrc } from '../lib/photos'

/**
 * Foto de paciente vinda do bucket privado — resolve a URL assinada e, enquanto
 * isso (ou se a foto não existir), mostra o fallback (iniciais, placeholder…).
 */
export function PatientPhoto({ src, alt = '', style, className, fallback = null }: {
  src?: string
  alt?: string
  style?: CSSProperties
  className?: string
  fallback?: ReactNode
}) {
  const url = usePhotoSrc(src)
  if (!url) return <>{fallback}</>
  return <img src={url} alt={alt} className={className} style={style} />
}
