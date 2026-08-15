import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="field-input" {...props} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="field-select" {...props} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="field-input" style={{ height: 'auto', minHeight: 96, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} {...props} />
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>
}
