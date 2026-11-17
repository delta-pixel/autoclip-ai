import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { processVideo } from './processor.js';
import { downloadYoutubeVideo } from './youtube.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const uploads = path.join(root, 'uploads');
const outputs = path.join(root, 'outputs');
fs.mkdirSync(uploads, {recursive:true}); fs.mkdirSync(outputs, {recursive:true});
const app = express();
app.use(cors({origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'}));
app.use(express.json());
const jobs = new Map();
const maxBytes = (Number(process.env.MAX_UPLOAD_GB) || 5) * 1024 ** 3;
const storage = multer.diskStorage({ destination: uploads, filename: (_req,file,cb) => cb(null, `${nanoid()}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({storage, limits:{fileSize:maxBytes}, fileFilter:(_req,file,cb)=>{
  const allowed = new Set(['video/mp4','video/quicktime','video/x-matroska','video/webm','video/x-msvideo']);
  cb(allowed.has(file.mimetype) ? null : new Error('Unsupported video type. Upload MP4, MOV, MKV, AVI, or WEBM.'), allowed.has(file.mimetype));
}});
app.get('/api/health', (_req,res)=>res.json({ok:true,service:'autoclip-api',jobs:jobs.size}));
app.get('/api/jobs', (_req,res)=>res.json([...jobs.values()].map(publicJob)));
app.get('/api/jobs/:id', (req,res)=>{ const j=jobs.get(req.params.id); if(!j)return res.status(404).json({error:'Job not found'}); res.json(publicJob(j)); });
app.post('/api/jobs/youtube', upload.none(), async (req,res)=>{
  const url = String(req.body?.url || '').trim();
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({error:'Enter a valid YouTube URL.'}); }
  const host = parsed.hostname.toLowerCase().replace(/^www\./,'');
  if (!['youtube.com','m.youtube.com','youtu.be'].includes(host)) {
    return res.status(400).json({error:'Only youtube.com and youtu.be links are supported.'});
  }
  let settings={}; try { settings=JSON.parse(req.body.settings||'{}'); } catch {}
  const id=nanoid(10);
  const job={id,status:'queued',stage:'Preparing YouTube download',progress:2,filePath:null,originalName:'YouTube video',sourceUrl:url,settings,clips:[],createdAt:new Date().toISOString()};
  jobs.set(id,job);
  res.status(202).json(publicJob(job));
  (async()=>{
    try {
      job.status='processing'; job.stage='Downloading YouTube video'; job.progress=8;
      const downloaded=await downloadYoutubeVideo(url,uploads,id);
      job.filePath=downloaded.filePath;
      job.originalName=downloaded.title || 'YouTube video';
      await processVideo(job,{outputs,ffmpegPath:process.env.FFMPEG_PATH});
    } catch(err) {
      job.status='failed'; job.error=err.message; job.stage='YouTube processing failed'; job.progress=0;
      console.error(`[${id}]`,err);
    }
  })();
});
app.post('/api/jobs', upload.single('video'), async (req,res)=>{
  if(!req.file)return res.status(400).json({error:'Choose a video file first.'});
  let settings={}; try{settings=JSON.parse(req.body.settings||'{}')}catch{}
  const id=nanoid(10);
  const job={id,status:'queued',stage:'Queued for analysis',progress:2,filePath:req.file.path,originalName:req.file.originalname,settings,clips:[],createdAt:new Date().toISOString()};
  jobs.set(id,job); res.status(202).json(publicJob(job));
  processVideo(job,{outputs,ffmpegPath:process.env.FFMPEG_PATH}).catch(err=>{
    job.status='failed';job.error=err.message;job.stage='Processing failed';job.progress=0;
    console.error(`[${id}]`,err);
  });
});
app.get('/api/jobs/:id/clips',(req,res)=>{const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:'Job not found'});res.json(j.clips.map(c=>({...c,url:`/api/files/${encodeURIComponent(c.filename)}`})));});
app.get('/api/jobs/:id/download',(req,res)=>{
  const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:'Job not found'});
  const files=j.clips.map(c=>path.join(outputs,c.filename));
  if(!files.length)return res.status(404).json({error:'No clips available'});
  res.json({message:'Batch download endpoint is ready; use individual clip links for now.',files:j.clips.map(c=>`/api/files/${encodeURIComponent(c.filename)}`)});
});
app.get('/api/files/:filename',(req,res)=>{
  const name=path.basename(req.params.filename);const file=path.join(outputs,name);
  if(!fs.existsSync(file))return res.status(404).json({error:'File not found'});
  res.download(file);
});
app.use((err,_req,res,_next)=>{console.error(err);res.status(err instanceof multer.MulterError ? 400 : 400).json({error:err.message||'Request failed'});});
function publicJob(j){return {id:j.id,status:j.status,stage:j.stage,progress:j.progress,originalName:j.originalName,error:j.error,createdAt:j.createdAt,clips:j.clips.map(c=>({...c,url:`/api/files/${encodeURIComponent(c.filename)}`}))};}
const port=Number(process.env.PORT)||4000;
app.listen(port,()=>console.log(`AutoClip API listening on http://localhost:${port}`));