
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(__dirname, '../../worker/download_youtube.py');

export function downloadYoutubeVideo(url, outputDir, id) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_PATH ||
  path.resolve(__dirname, '../../.venv/Scripts/python.exe');

    const p = spawn(
      python,
      ['-u', script, url, outputDir, id],
      {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      }
    );

    let stdout = '';
    let stderr = '';

    p.stdout.on('data', (data) => {
      stdout += data.toString('utf8');
    });

    p.stderr.on('data', (data) => {
      stderr += data.toString('utf8');
    });

    p.on('error', (error) => {
      reject(new Error(`Could not start Python: ${error.message}`));
    });

    p.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            stderr.trim().slice(-2000) ||
            stdout.trim().slice(-2000) ||
            `YouTube download failed with exit code ${code}.`
          )
        );
      }

      // Find the last valid JSON line in Python output.
      const lines = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const result = JSON.parse(lines[i]);

          if (result.filePath && result.title) {
            return resolve(result);
          }
        } catch {
          // Ignore non-JSON output and continue searching.
        }
      }

      reject(
        new Error(
          'Invalid Python response. Output: ' +
          (stdout.trim().slice(-1500) || 'No stdout received.') +
          '\nPython errors: ' +
          (stderr.trim().slice(-1000) || 'None')
        )
      );
    });
  });
}
