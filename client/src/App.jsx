import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Scissors, Sparkles, Film, Settings2, Download, Clock3, CheckCircle2, LoaderCircle, Languages, AudioLines, Captions, Zap } from 'lucide-react';

const fmt = (s=0) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export default function App() {
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [sourceMode, setSourceMode] = useState('upload');
  const [job, setJob] = useState(null);
  const [clips, setClips] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ clipLength: '45', aspect: '9:16', captions: true, silence: true, gpu: false, language: 'auto', template: 'Clean captions' });
  const input = useRef(null);

  useEffect(() => {
    if (!job || ['completed','failed'].includes(job.status)) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/jobs/${job.id}`);
        if (!r.ok) return;
        const data = await r.json();
        setJob(data);
        if (data.status === 'completed') { setClips(data.clips || []); setBusy(false); }
        if (data.status === 'failed') { setError(data.error || 'Processing failed'); setBusy(false); }
      } catch {}
    }, 1800);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  async function start() {
    if (sourceMode === 'upload' && !file) return;
    if (sourceMode === 'youtube' && !youtubeUrl.trim()) return;
    setBusy(true); setError(''); setClips([]);
    const body = new FormData();
    body.append('settings', JSON.stringify(settings));
    if (sourceMode === 'upload') body.append('video', file);
    else body.append('url', youtubeUrl.trim());
    try {
      const endpoint = sourceMode === 'upload' ? '/api/jobs' : '/api/jobs/youtube';
      const r = await fetch(endpoint, { method: 'POST', body });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not start job');
      setJob(data);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  const progress = job?.progress || 0;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Scissors size={19}/></div><span>AutoClip<span className="brand-ai">.ai</span></span></div>
      <div className="side-label">WORKSPACE</div>
      <button className="nav-item active"><Film size={17}/> Studio</button>
      <button className="nav-item" onClick={() => document.getElementById('settings')?.scrollIntoView({behavior:'smooth'})}><Settings2 size={17}/> Preferences</button>
      <div className="sidebar-bottom"><div className="local-pill"><span/> Local processing</div><p>Your videos stay on this machine.</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">VIDEO WORKSPACE / STUDIO</div><h1>Turn long videos into <span>great clips.</span></h1><p className="subhead">Drop in a recording. AutoClip finds the moments worth sharing.</p></div><div className="top-chip"><Zap size={14}/> AI CLIP ENGINE</div></header>
      <section className="workspace-grid">
        <div className="left-column">
          <section className="panel upload-panel">
            <div className="panel-heading"><div><span className="step">01</span><h2>Source video</h2></div><span className="muted">MP4 · MOV · MKV · WEBM</span></div>
            <div className="source-tabs">
              <button className={sourceMode==='upload'?'source-tab selected':'source-tab'} onClick={()=>setSourceMode('upload')}><UploadCloud size={14}/> Upload file</button>
              <button className={sourceMode==='youtube'?'source-tab selected':'source-tab'} onClick={()=>setSourceMode('youtube')}><Film size={14}/> YouTube link</button>
            </div>
            {sourceMode === 'upload' ? <div className={`dropzone ${file ? 'has-file' : ''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFile(e.dataTransfer.files?.[0] || null);}}>
              <input ref={input} type="file" accept="video/*" hidden onChange={e=>setFile(e.target.files?.[0] || null)}/>
              <div className="upload-icon"><UploadCloud size={24}/></div>
              {file ? <><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(1)} MB · Ready to analyse</span><button className="text-button" onClick={()=>setFile(null)}>Remove file</button></> : <><strong>Drag your video here</strong><span>or browse files from your computer</span><button className="secondary-button" onClick={()=>input.current?.click()}>Choose video</button></>}
            </div> : <div className="youtube-box">
              <label htmlFor="youtube-url">Paste a YouTube video URL</label>
              <input id="youtube-url" type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)}/>
              <p>Only use videos you own or have permission to use. YouTube access and downloads remain subject to its terms.</p>
            </div>}
            <div className="upload-foot"><span><CheckCircle2 size={14}/> Private, local-first workflow</span><span>Max upload size configured by server</span></div>
          </section>
          <section className="panel settings-panel" id="settings">
            <div className="panel-heading"><div><span className="step">02</span><h2>Clip settings</h2></div><span className="muted">AUTOMATION</span></div>
            <div className="setting-grid">
              <label>Target clip length<select value={settings.clipLength} onChange={e=>setSettings({...settings,clipLength:e.target.value})}><option value="30">Up to 30 seconds</option><option value="45">Up to 45 seconds</option><option value="60">Up to 60 seconds</option><option value="90">Up to 90 seconds</option></select></label>
              <label>Output format<select value={settings.aspect} onChange={e=>setSettings({...settings,aspect:e.target.value})}><option value="9:16">Vertical · 9:16</option><option value="1:1">Square · 1:1</option><option value="16:9">Landscape · 16:9</option></select></label>
              <label>Caption language<select value={settings.language} onChange={e=>setSettings({...settings,language:e.target.value})}><option value="auto">Auto detect</option><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option><option value="fr">French</option></select></label>
              <label>Caption style<select value={settings.template} onChange={e=>setSettings({...settings,template:e.target.value})}><option>Clean captions</option><option>Bold highlight</option><option>Minimal subtitle</option></select></label>
            </div>
            <div className="toggle-list">
              <Toggle icon={<Captions size={17}/>} title="Animated captions" desc="Burn readable subtitles into every clip" checked={settings.captions} onChange={v=>setSettings({...settings,captions:v})}/>
              <Toggle icon={<AudioLines size={17}/>} title="Remove long silences" desc="Find tighter, more watchable segments" checked={settings.silence} onChange={v=>setSettings({...settings,silence:v})}/>
              <Toggle icon={<Zap size={17}/>} title="Try NVIDIA hardware encoding" desc="Uses NVENC when available, otherwise CPU" checked={settings.gpu} onChange={v=>setSettings({...settings,gpu:v})}/>
            </div>
            <button className="primary-button" disabled={(sourceMode==='upload' ? !file : !youtubeUrl.trim()) || busy} onClick={start}>{busy ? <><LoaderCircle className="spin" size={17}/> Analysing video…</> : <><Sparkles size={17}/> Find my best clips</>}</button>
            {error && <div className="error">{error}</div>}
          </section>
        </div>
        <div className="right-column">
          <section className="panel process-panel">
            <div className="panel-heading"><div><span className="step">03</span><h2>AI processing</h2></div><span className={`status ${job?.status || 'idle'}`}>{job?.status || 'IDLE'}</span></div>
            <div className="process-visual"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="core"><Sparkles size={27}/></div></div>
            <div className="progress-meta"><span>{job?.stage || 'Waiting for a video'}</span><strong>{progress}%</strong></div><div className="progress-track"><div style={{width:`${progress}%`}}/></div>
            <div className="pipeline">
              <Pipeline icon={<AudioLines/>} title="Audio & speech analysis" state={progress>=25?'done':busy?'active':'waiting'}/>
              <Pipeline icon={<Sparkles/>} title="Highlight detection" state={progress>=55?'done':progress>=25?'active':'waiting'}/>
              <Pipeline icon={<Scissors/>} title="Clip generation" state={progress>=85?'done':progress>=55?'active':'waiting'}/>
              <Pipeline icon={<Captions/>} title="Captions & export" state={progress===100?'done':progress>=85?'active':'waiting'}/>
            </div>
          </section>
          <section className="tip-card"><div className="tip-icon"><Languages size={18}/></div><div><strong>Made for many languages</strong><p>Transcription can use Whisper's multilingual models. Choose Auto detect to let the model identify speech language.</p></div></section>
          <section className="panel results-panel">
            <div className="panel-heading"><div><span className="step">04</span><h2>Your clips</h2></div><span className="muted">{clips.length} FOUND</span></div>
            {clips.length ? <div className="clip-list">{clips.map((c,i)=><div className="clip-row" key={c.id}><div className="clip-thumb"><Film size={20}/><span>{String(i+1).padStart(2,'0')}</span></div><div className="clip-info"><strong>{c.title || `Highlight ${i+1}`}</strong><span>{fmt(c.start)} – {fmt(c.end)} · {fmt(c.duration)}</span><small>{c.reason || 'Automatically selected highlight'}</small></div><a className="download" href={c.url} download><Download size={16}/></a></div>)}<a className="download-all" href={`/api/jobs/${job.id}/download`}>Download all clips <Download size={15}/></a></div> : <div className="empty-results"><div className="empty-icon"><Film size={22}/></div><strong>Your highlights will appear here</strong><span>Upload a video and run the AI clip engine to get started.</span></div>}
          </section>
        </div>
      </section>
      <footer> AUTOCLIP AI <span>LOCAL-FIRST VIDEO WORKFLOW</span><span>BUILD 0.1.0</span></footer>
    </main>
  </div>;
}
function Toggle({icon,title,desc,checked,onChange}) { return <label className="toggle-row"><span className="toggle-icon">{icon}</span><span className="toggle-copy"><strong>{title}</strong><small>{desc}</small></span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="switch"/></label>; }
function Pipeline({icon,title,state}) { return <div className={`pipeline-row ${state}`}><span className="pipeline-icon">{icon}</span><span>{title}</span><span className="pipeline-state">{state==='done'?'Complete':state==='active'?'Working': 'Queued'}</span></div>; }