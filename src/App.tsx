import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'

type Step = 'upload' | 'generating' | 'done'

const STRUCTURE_PREVIEW = `generated-api/
├── app.js
├── sync.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── config/
│   └── connection.js
├── models/
│   └── [Entidad].model.js
├── controllers/
│   └── [Entidad].controller.js
└── routes/
    └── [Entidad].routes.js`

const FORMAT_EXAMPLE = `CREATE TABLE Cliente (
    ClienteId INT AUTO_INCREMENT PRIMARY KEY,
    nombre    VARCHAR(100) NOT NULL,
    email     VARCHAR(150),
    activo    BOOLEAN DEFAULT TRUE,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE Pedido (
    PedidoId  INT AUTO_INCREMENT PRIMARY KEY,
    ClienteId INT NOT NULL,
    total     DECIMAL(10,2) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ClienteId) REFERENCES Cliente(ClienteId)
);`

export default function App() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Generando proyecto...')
  const [error, setError] = useState('')
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const validExt = (name: string) => name.split('.').pop()?.toLowerCase() === 'sql'

  const setSelectedFile = (f: File) => {
    if (!validExt(f.name)) { setError('Solo se aceptan archivos .sql'); return }
    setFile(f); setError('')
  }

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setSelectedFile(f)
  }, [])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setSelectedFile(f)
  }

  const generate = async () => {
    if (!file) return
    setError(''); setStep('generating'); setProgress(0); setProgressLabel('Generando proyecto...')
    intervalRef.current = setInterval(() => {
      setProgress(p => Math.min(p + 12, 85))
    }, 200)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const apiBase = import.meta.env.VITE_API_URL ?? ''

      const response = await fetch(`${apiBase}/api/generate`, { method: 'POST', body: formData })
      if (intervalRef.current) clearInterval(intervalRef.current)
      setProgress(100); setProgressLabel('¡Listo!')
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al generar el proyecto')
      }
      const blob = await response.blob()
      setZipBlob(blob)
      setTimeout(() => setStep('done'), 500)
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setError((err as Error).message)
      setStep('upload'); setProgress(0)
    }
  }

  const download = () => {
    if (!zipBlob) return
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url; a.download = 'generated-api.zip'; a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setFile(null); setZipBlob(null); setError('')
    setProgress(0); setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const STEPS = [
    { id: 1, label: 'Subir', key: 'upload' },
    { id: 2, label: 'Generar', key: 'generating' },
    { id: 3, label: 'Listo', key: 'done' },
  ]
  const stepIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0ede8] flex flex-col items-center px-4 py-12">

      {/* Header */}
      <div className="w-full max-w-2xl mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-[#c8ff00] rounded-sm flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-xs font-mono tracking-[0.2em] text-[#666] uppercase">v2.0.0</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight leading-none">CRUD Generator</h1>
        <p className="text-[#888] mt-2 text-sm">
          Genera un proyecto <span className="text-[#c8ff00] font-medium">Node.js + Express + Sequelize</span> desde tu script SQL
        </p>
      </div>

      {/* Stepper */}
      <div className="w-full max-w-2xl flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${i <= stepIndex ? 'text-[#c8ff00]' : 'text-[#444]'}`}>
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono font-medium transition-all duration-300 ${
                i < stepIndex ? 'bg-[#c8ff00] border-[#c8ff00] text-black' :
                i === stepIndex ? 'border-[#c8ff00] text-[#c8ff00]' :
                'border-[#333] text-[#444]'
              }`}>
                {i < stepIndex ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s.id}
              </div>
              <span className="text-xs font-mono hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 transition-all duration-500 ${i < stepIndex ? 'bg-[#c8ff00]' : 'bg-[#222]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* UPLOAD / GENERATING */}
      {(step === 'upload' || step === 'generating') && (
        <div className="w-full max-w-2xl space-y-3">
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <p className="text-[10px] font-mono tracking-[0.18em] text-[#555] uppercase mb-4">Paso 1 — Sube tu script SQL</p>

            {step === 'upload' && (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                    dragOver ? 'border-[#c8ff00] bg-[#c8ff0008]' : 'border-[#2a2a2a] hover:border-[#444] hover:bg-[#ffffff04]'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                  </div>
                  <p className="text-[#888] text-sm">Arrastra tu archivo aquí o <span className="text-[#f0ede8] underline underline-offset-2">haz clic para buscar</span></p>
                  <p className="text-[#444] text-xs font-mono mt-2">.sql</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".sql" className="hidden" onChange={handleFileChange} />

                {file && (
                  <div className="flex items-center gap-3 mt-4 px-4 py-3 bg-[#0f1f0d] border border-[#2a4a2a] rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#6dda6d] flex-shrink-0" />
                    <span className="text-sm flex-1 font-mono text-[#aadaaa] truncate">{file.name}</span>
                    <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-[#666] hover:text-[#999] transition-colors text-sm">✕</button>
                  </div>
                )}

                {error && (
                  <div className="mt-3 px-4 py-3 bg-[#1f0d0d] border border-[#4a2a2a] rounded-xl text-sm text-[#da6d6d] font-mono">
                    {error}
                  </div>
                )}

                <button
                  onClick={generate}
                  disabled={!file}
                  className={`w-full mt-4 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 ${
                    file
                      ? 'bg-[#c8ff00] text-black hover:bg-[#d4ff33] active:scale-[0.99]'
                      : 'bg-[#1a1a1a] text-[#444] cursor-not-allowed border border-[#222]'
                  }`}
                >
                  Generar proyecto ZIP
                </button>
              </>
            )}

            {step === 'generating' && (
              <div className="py-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#888]">{progressLabel}</span>
                  <span className="text-xs font-mono text-[#c8ff00]">{progress}%</span>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full bg-[#c8ff00] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex gap-1 mt-6 justify-center">
                  {[0.1, 0.2, 0.3].map((d, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-[#333] rounded-full animate-pulse" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Format card */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <p className="text-[10px] font-mono tracking-[0.18em] text-[#555] uppercase mb-4">Formato esperado — script SQL</p>
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 overflow-x-auto">
              <pre className="text-[11px] font-mono text-[#666] leading-relaxed whitespace-pre">{FORMAT_EXAMPLE}</pre>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-[11px] text-[#555]">✔ Soporta <code className="text-[#888]">FOREIGN KEY</code> — genera asociaciones Sequelize automáticamente</p>
              <p className="text-[11px] text-[#555]">✔ <code className="text-[#888]">CreatedAt / UpdatedAt</code> se ignoran — Sequelize los maneja con <code className="text-[#888]">timestamps: true</code></p>
              <p className="text-[11px] text-[#555]">✔ Compatible con MySQL, PostgreSQL y SQL estándar</p>
            </div>
          </div>
        </div>
      )}

      {/* DONE */}
      {step === 'done' && (
        <div className="w-full max-w-2xl space-y-3">
          <div className="bg-[#111] border border-[#1e3a1e] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#c8ff00] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Proyecto generado</h2>
            <p className="text-[#888] text-sm mb-6">Tu API REST con Node.js + Express + Sequelize está lista para usar</p>
            <button onClick={download}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#c8ff00] text-black rounded-xl font-semibold text-sm hover:bg-[#d4ff33] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Descargar ZIP
            </button>
          </div>
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <p className="text-[10px] font-mono tracking-[0.18em] text-[#555] uppercase mb-3">Estructura generada</p>
            <pre className="text-[12px] font-mono text-[#666] leading-relaxed">{STRUCTURE_PREVIEW}</pre>
          </div>
          <button onClick={reset}
            className="w-full py-3 rounded-xl font-medium text-sm text-[#666] border border-[#1e1e1e] hover:border-[#333] hover:text-[#888] transition-all">
            Generar otro proyecto
          </button>
        </div>
      )}

      <p className="mt-12 text-[#333] text-xs font-mono">CRUD Generator v2.0 · Node.js + Express + Sequelize</p>
    </div>
  )
}
