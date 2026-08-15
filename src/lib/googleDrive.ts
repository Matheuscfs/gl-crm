import { googleToken } from './google'

const CLINIC_FOLDER = 'Gabriela Lorenzi — CRM'
let clinicFolderId: string | null = null
const patientFolders: Record<string, string> = {}

async function findOrCreateFolder(name: string, parent?: string): Promise<string | null> {
  const token = googleToken()
  if (!token) return null
  const safe = name.replace(/'/g, "\\'")
  let q = `name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  if (parent) q += ` and '${parent}' in parents`
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const d = await r.json()
  if (d.files?.length) return d.files[0].id as string
  const meta: Record<string, unknown> = { name, mimeType: 'application/vnd.google-apps.folder' }
  if (parent) meta.parents = [parent]
  const c = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  })
  const cd = await c.json()
  return (cd.id as string) ?? null
}

async function clinicFolder() {
  if (clinicFolderId) return clinicFolderId
  clinicFolderId = await findOrCreateFolder(CLINIC_FOLDER)
  return clinicFolderId
}

async function patientFolder(name: string) {
  if (patientFolders[name]) return patientFolders[name]
  const cf = await clinicFolder()
  if (!cf) return null
  const id = await findOrCreateFolder(name || 'Sem nome', cf)
  if (id) patientFolders[name] = id
  return id
}

/** Envia um arquivo ao Drive, dentro de "Gabriela Lorenzi — CRM / {paciente}". */
export async function uploadToDrive(patientName: string, file: File, filename?: string): Promise<{ id: string; link: string } | null> {
  const token = googleToken()
  if (!token) return null
  const folder = await patientFolder(patientName)
  const meta: Record<string, unknown> = { name: filename || file.name }
  if (folder) meta.parents = [folder]

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', file)

  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!r.ok) {
    console.error('[gdrive]', await r.text())
    return null
  }
  const d = await r.json()
  return { id: d.id as string, link: (d.webViewLink as string) ?? '' }
}
