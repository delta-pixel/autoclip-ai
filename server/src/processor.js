import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import ffmpegStatic from 'ffmpeg-static';
import { detectHighlights, transcribe } from './worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const run = (args) => new Promise((resolve,reject)=>{
  const p=spawn(ffmpeg,args,{windowsHide:true});let stderr='';
  p.stderr.on('data',d=>stderr+=d.toString());
  p.on('error',reject);p.on('close',code=>code===0?resolve(stderr):reject(new Error(stderr.slice(-1800)||`FFmpeg exited ${code}`)));
});
const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50);

export async function processVideo(job,{outputs}) {
  const set=(progress,stage)=>{job.progress=progress;job.stage=stage;job.status='processing';};
  set(8,'Reading video metadata');
  const meta=await probe(job.filePath);
  if(meta.duration<4)throw new Error('Video is too short. Please upload a video longer than 4 seconds.');
  set(20,'Transcribing speech (optional Whisper)');
  const transcript=await transcribe(job.filePath).catch(err=>{console.warn('Whisper unavailable:',err.message);return [];});
  set(42,'Finding high-potential moments');
  const maxLen=Math.min(90,Math.max(15,Number(job.settings.clipLength)||45));
  const clips=detectHighlights({duration:meta.duration,transcript,maxLen,removeSilence:job.settings.silence!==false});
  if(!clips.length)throw new Error('Could not find usable segments in this video.');
  job.clips=[];
  for(let i=0;i<clips.length;i++){
    const c=clips[i];set(48+Math.round((i/clips.length)*43),`Rendering clip ${i+1} of ${clips.length}`);
    const filename=`${safe(job.id)}_${String(i+1).padStart(2,'0')}.mp4`;
    const out=path.join(outputs,filename);
    const aspect=job.settings.aspect||'9:16';
    const vf=videoFilter(aspect,job.settings.captions!==false);
    const encoder=job.settings.gpu && process.env.AUTOCLIP_NVENC==='1' ? ['-c:v','h264_nvenc','-preset','p4'] : ['-c:v','libx264','-preset','veryfast','-crf','22'];
    const args=['-y','-ss',String(c.start),'-i',job.filePath,'-t',String(c.end-c.start),'-vf',vf,...encoder,'-c:a','aac','-b:a','160k','-movflags','+faststart',out];
    await run(args);
    job.clips.push({id:nanoid(8),filename,title:c.title||`Highlight ${i+1}`,start:c.start,end:c.end,duration:c.end-c.start,reason:c.reason||'Potential highlight'});
  }
  set(100,'All clips exported');job.status='completed';
}
function videoFilter(aspect,captions){
  let crop;
  if(aspect==='1:1')crop='crop=min(iw\\,ih):min(iw\\,ih)';
  else if(aspect==='16:9')crop='crop=iw:ih';
  else crop='crop=ih*9/16:ih';
  // Center crop is the safe baseline. Face-aware tracking is a planned worker extension.
  return `${crop},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1`;
}
async function probe(file){
  const {default:probeStatic}=await import('ffprobe-static');
  const bin=probeStatic.path;
  return new Promise((resolve,reject)=>{
    const p=spawn(bin,['-v','quiet','-print_format','json','-show_format','-show_streams',file]);let out='',err='';
    p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
    p.on('error',reject);p.on('close',code=>{if(code!==0)return reject(new Error(err||'ffprobe failed'));try{const j=JSON.parse(out);resolve({duration:Number(j.format.duration)||0});}catch(e){reject(e);}});
  });
}