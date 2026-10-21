#!/usr/bin/env bash
# Builds a jsimgui checkout (Dear ImGui compiled with Emscripten + generated JS bindings) into an output folder.
# Usage: build-jsimgui.sh <jsimgui checkout> <output dir>
# Needs emcc and node on PATH. CI runs this for each entry in imgui-versions.json.
set -euo pipefail

src="$(cd "$1" && pwd)"
mkdir -p "$2"
out="$(cd "$2" && pwd)"

cd "$src"
npm ci --no-audit --no-fund
# --throw-asserts: a failed IM_ASSERT throws a JS Error the playground can report, instead of
# aborting the whole runtime.
node build.ts --throw-asserts

cp build/mod.js build/imgui.js build/imgui.d.ts build/imnodes.js build/implot.js build/loader.js "$out/"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ imgui: process.argv[2], jsimgui: process.argv[3], emscripten: process.argv[4] }, null, 2) + "\n")' \
  "$out/build-info.json" \
  "$(grep -m1 -oP '#define IMGUI_VERSION\s+"\K[^"]+' third_party/imgui/imgui.h)" \
  "$(git rev-parse --short HEAD)" \
  "$(emcc --version | head -1)"
ls -la "$out"
