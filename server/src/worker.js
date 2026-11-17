
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const script = path.resolve(
  __dirname,
  '../../worker/analyse.py'
);

// Use the project's virtual environment by default.
const python =
  process.env.PYTHON_PATH ||
  path.resolve(__dirname, '../../.venv/Scripts/python.exe');

export async function transcribe(videoPath) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      python,
      [script, videoPath],
      {
        windowsHide: true,
        env: {
          ...process.env,
          WHISPER_MODEL: process.env.WHISPER_MODEL || 'base',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          PYTHONUNBUFFERED: '1'
        }
      }
    );

    let out = '';
    let err = '';

    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');

    p.stdout.on('data', data => {
      out += data;
    });

    p.stderr.on('data', data => {
      err += data;
    });

    p.on('error', error => {
      reject(
        new Error(`Could not start Whisper Python worker: ${error.message}`)
      );
    });

    p.on('close', code => {
      if (code !== 0) {
        return reject(
          new Error(
            err.trim() ||
            out.trim() ||
            `Whisper worker exited with code ${code}`
          )
        );
      }

      try {
        resolve(JSON.parse(out.trim()));
      } catch {
        reject(
          new Error(
            `Invalid transcription response. Output: ${out.slice(-1000)}`
          )
        );
      }
    });
  });
}

export function detectHighlights({
  duration,
  transcript,
  maxLen = 45
}) {
  const segments = [];

  if (transcript?.length) {
    const scored = transcript.map(s => {
      const text = (s.text || '').trim();
      const words = text.split(/\s+/).filter(Boolean).length;

      const energy =
        (text.match(/[!?]/g) || []).length * 2 +
        (text.match(
          /\b(why|how|secret|mistake|best|never|important|amazing|because|imagine|actually)\b/gi
        ) || []).length;

      return {
        start: Math.max(0, s.start - 1.5),
        end: Math.min(duration, s.end + 2),
        score: energy + Math.min(words / 12, 3),
        text
      };
    }).filter(s => s.end - s.start >= 8);

    scored.sort((a, b) => b.score - a.score);

    for (const s of scored) {
      if (segments.length >= 8) break;

      const start = Math.max(
        0,
        Math.min(s.start, Math.max(0, duration - maxLen))
      );

      const end = Math.min(
        duration,
        Math.max(start + 12, Math.min(s.end, start + maxLen))
      );

      if (
        end - start >= 8 &&
        segments.every(
          x => end <= x.start + 4 || start >= x.end - 4
        )
      ) {
        segments.push({
          start,
          end,
          score: s.score,
          title: s.text.slice(0, 58) || 'Interesting moment',
          reason: 'Speech highlight'
        });
      }
    }
  }

  // Fallback when transcription is unavailable or empty.
  if (!segments.length) {
    const count = Math.min(
      6,
      Math.max(1, Math.ceil(duration / 180))
    );

    const slot = duration / count;

    for (let i = 0; i < count; i++) {
      const start = Math.max(
        0,
        Math.min(
          Math.max(0, duration - maxLen),
          i * slot + Math.max(0, (slot - maxLen) / 2)
        )
      );

      const end = Math.min(duration, start + maxLen);

      if (end - start >= 8) {
        segments.push({
          start,
          end,
          title: `Video highlight ${i + 1}`,
          reason: 'Evenly sampled segment. Enable Whisper for speech-aware scoring.'
        });
      }
    }
  }

  return segments
    .sort((a, b) => a.start - b.start)
    .slice(0, 8)
    .map(({ start, end, title, reason }) => ({
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      title,
      reason
    }));
}
