import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { fmtShort, isoDate, parseDate } from '../lib/dates'
import { latestWeight } from '../lib/data'
import { Seg, Sheet, useToast } from './ui'

type Pose = 'front' | 'side' | 'back'
export interface Photo { id: number; taken_on: string; pose: Pose; path: string; weight_kg: number | null; url?: string }
const BUCKET = 'progress-photos'
const POSES: { id: Pose; label: string }[] = [{ id: 'front', label: 'Front' }, { id: 'side', label: 'Side' }, { id: 'back', label: 'Back' }]

async function loadPhotos(): Promise<Photo[]> {
  const { data } = await supabase.from('progress_photos').select('*').order('taken_on').order('created_at')
  const list = (data ?? []) as Photo[]
  if (!list.length) return list
  const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(list.map((p) => p.path), 3600)
  const map = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]))
  return list.map((p) => ({ ...p, url: map.get(p.path) ?? undefined }))
}

async function shrink(file: File, max = 1280): Promise<Blob> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the photo'))), 'image/jpeg', 0.85))
}

function usePhotos() {
  const { version } = useStore()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const reload = useCallback(() => loadPhotos().then(setPhotos), [])
  useEffect(() => { reload() }, [reload, version])
  return { photos, reload }
}

const label = (p: Photo) => `${fmtShort(parseDate(p.taken_on))}${p.weight_kg ? ` · ${Number(p.weight_kg)} kg` : ''}`

export function ProgressCard() {
  const { photos, reload } = usePhotos()
  const [sheet, setSheet] = useState<null | 'add' | 'all' | 'compare' | 'lapse'>(null)
  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const latest = (photos ?? []).slice(-4).reverse()

  return (
    <section className="card">
      <div className="card-head">
        <h2>📸 Progress photos</h2>
        <button className="btn ghost sm" onClick={() => input.current?.click()}>+ Add</button>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFile(f); setSheet('add') } }} />
      {photos === null ? <div className="small muted">Loading…</div> : photos.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>Take a photo once a week, same spot, same light. The scale can stall while your body still changes, and photos show it. 🔒 Only you can see them.</p>
      ) : (
        <>
          <div className="pp-strip">
            {latest.map((p) => (
              <button key={p.id} className="pp-thumb" onClick={() => setSheet('all')}>
                {p.url && <img src={p.url} alt={`Progress photo ${label(p)}`} loading="lazy" />}
                <span>{fmtShort(parseDate(p.taken_on))}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn ghost grow sm" disabled={photos.length < 2} onClick={() => setSheet('compare')}>↔ Compare</button>
            <button className="btn ghost grow sm" disabled={photos.length < 2} onClick={() => setSheet('lapse')}>▶ Time-lapse</button>
            <button className="btn ghost sm" onClick={() => setSheet('all')}>All {photos.length}</button>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>🔒 Private. Only you can see your photos.</p>
        </>
      )}
      {sheet === 'add' && file && <AddPhoto file={file} onClose={() => setSheet(null)} onSaved={reload} />}
      {sheet === 'all' && photos && <AllPhotos photos={photos} onClose={() => setSheet(null)} onChanged={reload} />}
      {sheet === 'compare' && photos && <Compare photos={photos} onClose={() => setSheet(null)} />}
      {sheet === 'lapse' && photos && <TimeLapse photos={photos} onClose={() => setSheet(null)} />}
    </section>
  )
}

function AddPhoto({ file, onClose, onSaved }: { file: File; onClose: () => void; onSaved: () => void }) {
  const { session } = useStore()
  const toast = useToast()
  const [pose, setPose] = useState<Pose>('front')
  const [day, setDay] = useState(isoDate())
  const [busy, setBusy] = useState(false)
  const [preview] = useState(() => URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(preview), [preview])

  async function save() {
    if (!session) return
    setBusy(true)
    try {
      const blob = await shrink(file)
      const path = `${session.user.id}/${day}-${pose}-${Date.now()}.jpg`
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const w = await latestWeight()
      const { error } = await supabase.from('progress_photos').insert({ taken_on: day, pose, path, weight_kg: w?.weight_kg ?? null })
      if (error) throw error
      toast('Photo saved 🔒')
      onSaved()
      onClose()
    } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }

  return (
    <Sheet title="New progress photo" onClose={onClose}>
      <img className="pp-preview" src={preview} alt="Preview" />
      <label className="field"><span>Pose</span><Seg options={POSES} value={pose} onChange={setPose} /></label>
      <label className="field"><span>Date</span><input className="input" type="date" value={day} max={isoDate()} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
      <button className="btn block" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save privately'}</button>
    </Sheet>
  )
}

function usePose(photos: Photo[]) {
  const has = (p: Pose) => photos.some((x) => x.pose === p)
  const [pose, setPose] = useState<Pose>(() => (['front', 'side', 'back'] as Pose[]).sort((a, b) => photos.filter((x) => x.pose === b).length - photos.filter((x) => x.pose === a).length)[0])
  const opts = POSES.filter((p) => has(p.id))
  return { pose, setPose, opts, list: photos.filter((x) => x.pose === pose) }
}

function AllPhotos({ photos, onClose, onChanged }: { photos: Photo[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState<Photo | null>(null)
  async function remove(p: Photo) {
    if (!confirm('Delete this photo for good?')) return
    await supabase.storage.from(BUCKET).remove([p.path])
    await supabase.from('progress_photos').delete().eq('id', p.id)
    toast('Photo deleted')
    setOpen(null)
    onChanged()
  }
  if (open) return (
    <Sheet title={label(open)} onClose={() => setOpen(null)}>
      {open.url && <img className="pp-preview" src={open.url} alt={label(open)} />}
      <p className="small muted">{POSES.find((p) => p.id === open.pose)?.label} · {fmtShort(parseDate(open.taken_on))}</p>
      <button className="btn danger block" onClick={() => remove(open)}>Delete photo</button>
    </Sheet>
  )
  return (
    <Sheet title="Progress photos" onClose={onClose}>
      <div className="pp-grid">
        {[...photos].reverse().map((p) => (
          <button key={p.id} className="pp-thumb" onClick={() => setOpen(p)}>
            {p.url && <img src={p.url} alt={label(p)} loading="lazy" />}
            <span>{fmtShort(parseDate(p.taken_on))} · {p.pose}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Compare({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const { pose, setPose, opts, list } = usePose(photos)
  const [a, setA] = useState(0)
  const [b, setB] = useState(Math.max(0, list.length - 1))
  const [split, setSplit] = useState(50)
  const [mode, setMode] = useState<'side' | 'slider'>('side')
  useEffect(() => { setA(0); setB(Math.max(0, list.length - 1)) }, [pose, list.length])
  const A = list[a], B = list[b]
  const diff = A?.weight_kg && B?.weight_kg ? Math.round((Number(B.weight_kg) - Number(A.weight_kg)) * 10) / 10 : null
  const days = A && B ? Math.round((parseDate(B.taken_on).getTime() - parseDate(A.taken_on).getTime()) / 864e5) : 0
  return (
    <Sheet title="Compare" onClose={onClose}>
      {opts.length > 1 && <div style={{ marginBottom: 10 }}><Seg options={opts} value={pose} onChange={setPose} /></div>}
      {list.length < 2 ? <div className="empty">Add at least two {pose} photos to compare.</div> : (
        <>
          <Seg options={[{ id: 'side', label: 'Side by side' }, { id: 'slider', label: 'Slider' }]} value={mode} onChange={setMode} />
          {mode === 'side' ? (
            <div className="pp-pair">
              <figure><img src={A.url} alt={`Before ${label(A)}`} /><figcaption>{label(A)}</figcaption></figure>
              <figure><img src={B.url} alt={`After ${label(B)}`} /><figcaption>{label(B)}</figcaption></figure>
            </div>
          ) : (
            <div className="pp-slider">
              <img src={A.url} alt={`Before ${label(A)}`} />
              <img src={B.url} alt={`After ${label(B)}`} style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
              <div className="pp-line" style={{ left: `${split}%` }} />
              <span className="pp-tag l">{fmtShort(parseDate(A.taken_on))}</span><span className="pp-tag r">{fmtShort(parseDate(B.taken_on))}</span>
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Before and after slider" />
            </div>
          )}
          <div className="pp-sum">
            <b>{days} days</b>{diff != null && <> · <b style={{ color: diff <= 0 ? 'var(--accent)' : undefined }}>{diff > 0 ? '+' : ''}{diff} kg</b></>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label className="field grow" style={{ margin: 0 }}><span>Before</span>
              <select className="input" value={a} onChange={(e) => setA(Number(e.target.value))}>{list.map((p, i) => <option key={p.id} value={i}>{label(p)}</option>)}</select>
            </label>
            <label className="field grow" style={{ margin: 0 }}><span>After</span>
              <select className="input" value={b} onChange={(e) => setB(Number(e.target.value))}>{list.map((p, i) => <option key={p.id} value={i}>{label(p)}</option>)}</select>
            </label>
          </div>
        </>
      )}
    </Sheet>
  )
}

function TimeLapse({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const { pose, setPose, opts, list } = usePose(photos)
  const [i, setI] = useState(0)
  const [play, setPlay] = useState(true)
  const [speed, setSpeed] = useState<'slow' | 'fast'>('slow')
  useEffect(() => { setI(0) }, [pose])
  useEffect(() => {
    if (!play || list.length < 2) return
    const t = setTimeout(() => setI((x) => (x + 1) % list.length), i === list.length - 1 ? 1600 : speed === 'slow' ? 800 : 350)
    return () => clearTimeout(t)
  }, [play, i, list.length, speed])
  const p = list[Math.min(i, list.length - 1)]
  return (
    <Sheet title="Time-lapse" onClose={onClose}>
      {opts.length > 1 && <div style={{ marginBottom: 10 }}><Seg options={opts} value={pose} onChange={setPose} /></div>}
      {list.length < 2 ? <div className="empty">Add at least two {pose} photos for a time-lapse.</div> : (
        <>
          <div className="pp-lapse">
            {list.map((x, n) => <img key={x.id} src={x.url} alt={label(x)} style={{ opacity: n === i ? 1 : 0 }} />)}
            <span className="pp-cap">{label(p)}</span>
          </div>
          <input type="range" min={0} max={list.length - 1} value={i} onChange={(e) => { setPlay(false); setI(Number(e.target.value)) }} style={{ width: '100%', accentColor: 'var(--accent)' }} aria-label="Photo" />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn grow" onClick={() => setPlay(!play)}>{play ? '⏸ Pause' : '▶ Play'}</button>
            <Seg options={[{ id: 'slow', label: 'Slow' }, { id: 'fast', label: 'Fast' }]} value={speed} onChange={setSpeed} />
          </div>
        </>
      )}
    </Sheet>
  )
}
