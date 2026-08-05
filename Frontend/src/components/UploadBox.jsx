import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UploadCloud, File as FileIcon, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { api } from '../services/api'

const ACCEPTED = '.pdf,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadBox({ compact = false, onUploaded }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      file,
    }))
    setFiles((prev) => [...prev, ...newFiles])

    newFiles.forEach(async (nf) => {
      try {
        const { upload } = await api.uploadFile(nf.file)
        setFiles((prev) => prev.map((f) => (f.id === nf.id ? { ...f, status: 'success' } : f)))
        onUploaded?.({ id: upload.id, name: nf.name, url: upload.file_url, type: upload.file_type })
      } catch (err) {
        setFiles((prev) => prev.map((f) => (f.id === nf.id ? { ...f, status: 'error', error: err.message } : f)))
      }
    })
  }

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const onDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div
          className="focus-ring border-2 border-dashed border-border-md rounded-2xl p-8 text-center cursor-pointer transition-all bg-surface-2 hover:border-primary hover:bg-primary-dim"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        >
          <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-gradient-ai-soft text-primary">
            <UploadCloud size={28} />
          </div>
          <p className="text-sm text-on-muted">
            <span className="text-primary font-medium">{t('mock.upload.dropzone')}</span> {t('mock.upload.dropzoneSuffix')}
          </p>
          <p className="text-xs text-on-dim mt-1.5">{t('mock.upload.types')}</p>
        </div>
      )}

      {compact && (
        <button className="focus-ring w-9 h-9 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors" onClick={() => inputRef.current?.click()} aria-label={t('chat.attachFile')}>
          <UploadCloud size={18} />
        </button>
      )}

      <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-start gap-3 p-3 bg-surface-4 border border-border rounded-xl animate-fade-up">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-6 text-primary flex-shrink-0">
                <FileIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-on-surface truncate">{file.name}</span>
                  <span className="text-xs text-on-muted flex-shrink-0">{formatBytes(file.size)}</span>
                </div>
                <div className="h-1 bg-surface-6 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${file.status === 'success' ? 'bg-success w-full' : file.status === 'error' ? 'bg-error w-full' : 'bg-primary w-full animate-pulse'}`}
                  />
                </div>
                <div className="text-xs text-on-muted mt-1.5 flex items-center gap-1">
                  {file.status === 'uploading' && <span>{t('mock.upload.uploading')}</span>}
                  {file.status === 'success' && <span className="text-success flex items-center gap-1"><CheckCircle2 size={13} /> {t('mock.upload.success')}</span>}
                  {file.status === 'error' && <span className="text-error flex items-center gap-1"><AlertCircle size={13} /> {file.error || t('mock.upload.error')}</span>}
                </div>
              </div>
              <button className="focus-ring w-6 h-6 flex items-center justify-center rounded-md text-on-muted hover:bg-surface-6 hover:text-on-surface transition-colors flex-shrink-0" onClick={() => removeFile(file.id)} aria-label={t('common.close')}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
