
import json
import os
import sys
from pathlib import Path
from yt_dlp import YoutubeDL


class YTDLPLogger:
    """Keep yt-dlp logs away from the JSON response on stdout."""

    def debug(self, message):
        pass

    def warning(self, message):
        print(message, file=sys.stderr, flush=True)

    def error(self, message):
        print(message, file=sys.stderr, flush=True)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    if len(sys.argv) != 4:
        raise SystemExit(
            "Usage: download_youtube.py <url> <output_dir> <job_id>"
        )

    url, output_dir, job_id = sys.argv[1:]

    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    script_dir = Path(__file__).resolve().parent
    cookies_path = script_dir / "cookies.txt"

    template = str(output_path / f"{job_id}_source.%(ext)s")

    opts = {
        "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
        "merge_output_format": "mp4",
        "outtmpl": template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "logger": YTDLPLogger(),
        "restrictfilenames": True,
        "max_filesize": 5 * 1024 * 1024 * 1024,
        "socket_timeout": 30,
        "retries": 3,
        "js_runtimes": {
            "node": {}
        },
    }

    # Use cookies only when the user has supplied their own local file.
    if cookies_path.is_file():
        opts["cookiefile"] = str(cookies_path)

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

        filename = Path(ydl.prepare_filename(info))

        # yt-dlp may merge the downloaded streams into MP4.
        merged = filename.with_suffix(".mp4")

        if merged.is_file():
            filename = merged

        if not filename.is_file():
            candidates = list(
                output_path.glob(f"{job_id}_source.*")
            )

            candidates = [
                item for item in candidates
                if item.is_file()
            ]

            if not candidates:
                raise RuntimeError(
                    "Download completed but the output file was not found."
                )

            filename = max(
                candidates,
                key=lambda item: item.stat().st_size
            )

        result = {
            "filePath": str(filename.resolve()),
            "title": info.get("title") or "YouTube video"
        }

        print(
            json.dumps(result, ensure_ascii=True),
            flush=True
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"YouTube download failed: {error}", file=sys.stderr)
        sys.exit(1)
