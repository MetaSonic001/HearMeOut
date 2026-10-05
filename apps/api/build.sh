#!/usr/bin/env bash
# Build step for hosts that run the API as a plain Python service (Render, Railway, ...).
# With OCR_ENABLED=false (set this on small free instances) the OCR packages are not installed at all.
set -euo pipefail

python -m pip install --upgrade pip

if [ "${OCR_ENABLED:-true}" = "false" ]; then
  python -m pip install .
  echo "OCR is switched off: skipped the OCR packages."
  exit 0
fi

python -m pip install ".[ocr]"

# OCR pulls in OpenCV's default wheel, which needs a system graphics library that small hosts do not have.
# The headless build is identical for reading text from images.
python -m pip uninstall -y opencv-python opencv-python-headless >/dev/null 2>&1 || true
python -m pip install --no-cache-dir opencv-python-headless

# Download the OCR language models now so the first scanned PDF is not slow. Best effort: they also download on first use.
python -m app.services.ocr || echo "OCR model download skipped; models will download on first use."
