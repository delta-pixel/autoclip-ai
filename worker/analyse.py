
import json
import os
import sys
from faster_whisper import WhisperModel


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: analyse.py <video>")

    video_path = sys.argv[1]

    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    model_name = os.environ.get("WHISPER_MODEL", "base")

    print(
        f"Loading Whisper model: {model_name}",
        file=sys.stderr,
        flush=True
    )

    # CPU int8 is the reliable default for this machine.
    try:
        model = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8"
        )

    except Exception as error:
        raise RuntimeError(
            f"Could not initialize Whisper model: {error}"
        ) from error

    segments, info = model.transcribe(
        video_path,
        beam_size=3,
        vad_filter=True
    )

    result = []

    for segment in segments:
        result.append({
            "start": float(segment.start),
            "end": float(segment.end),
            "text": segment.text.strip()
        })

    print(
        json.dumps(result, ensure_ascii=True),
        flush=True
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            f"Whisper analysis failed: {error}",
            file=sys.stderr,
            flush=True
        )
        sys.exit(1)
