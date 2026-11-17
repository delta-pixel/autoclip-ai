# AutoClip AI

Local-first AI video clipping web app. Upload a long video, analyse it, and generate vertical clips with captions and export them in a batch.

## Current starter implementation
- React + Vite dashboard with local upload, YouTube URL input, processing status, and clip gallery.
- Express API with upload validation and job tracking.
- FFmpeg-based silence detection and clip rendering (CPU by default, optional NVIDIA NVENC).
- Optional Python `faster-whisper` transcription worker and `yt-dlp` YouTube source downloader. If unavailable, the app still generates clips using a scene/silence heuristic and marks transcript captions unavailable.
- Batch MP4 output and generated metadata.

## Requirements
- Node.js 20+
- FFmpeg installed and available on PATH (`ffmpeg -version`)
- Python 3.10+ (optional, for Whisper transcription)
- NVIDIA driver + FFmpeg built with NVENC (optional GPU encoding)

## Run
```bash
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173. API runs on http://localhost:4000.

For transcription:
```bash
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r worker/requirements.txt
```
Set `WHISPER_MODEL=small` in `.env`. The first run downloads the model. CPU is supported; CUDA support depends on your PyTorch/CTranslate2 installation.

## Processing notes
- Files are stored locally in `server/uploads` and outputs in `server/outputs`.
- The API has a 5 GB default upload limit. Adjust `MAX_UPLOAD_GB`.
- GPU encoding is attempted only when `AUTOCLIP_NVENC=1`; otherwise CPU `libx264` is used. NVENC is encoding acceleration, not AI inference.
- This is an MVP foundation, not a production deployment. Add authentication, quotas, cleanup policies, malware scanning, and durable job storage before exposing it publicly.
- Music is opt-in and currently uses a user-provided local audio file path configured server-side; do not use copyrighted tracks without permission.

## API
- `GET /api/health`
- `GET /api/jobs`
- `GET /api/jobs/:id`
- `POST /api/jobs` multipart field `video`
- `POST /api/jobs/youtube` multipart fields `url` and `settings`
- `GET /api/jobs/:id/clips`
- `GET /api/files/:filename` serves generated MP4 files

## Roadmap
1. Replace heuristic highlight scoring with transcript-semantic scoring (LLM or local model).
2. Add face-aware crop tracking with OpenCV/MediaPipe and per-frame crop metadata.
3. Add editable caption themes and language translation.
4. Add template presets, licensed music library, and user-configurable export settings.
5. Add persistent database, job queue, auth, and resumable uploads.

## YouTube source support
Paste a public YouTube video URL in the YouTube Link tab. The backend accepts `youtube.com` and `youtu.be` hosts only, downloads one video (not a playlist), then sends it through the local clip pipeline. Only download videos you own or are authorized to use, and comply with YouTube's terms and applicable copyright law. Some videos may be unavailable due to region, age, sign-in, or other access restrictions.
