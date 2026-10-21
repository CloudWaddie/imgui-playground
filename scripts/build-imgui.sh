#!/usr/bin/env bash
# Builds an imgui-js checkout (Dear ImGui compiled with Emscripten + JS bindings) into an output folder.
# Usage: build-imgui.sh <imgui-js checkout> <output dir>
# Needs emcc and node on PATH. CI runs this for each entry in imgui-versions.json.
set -euo pipefail

src="$(cd "$1" && pwd)"
mkdir -p "$2"
out="$(cd "$2" && pwd)"

cd "$src"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund --no-save; fi
make build-bind-imgui         # emcc: imgui + bindings -> build/bind-imgui.js (wasm inlined)
npm run build-imgui           # tsc: src/imgui.ts -> build/imgui.js + typings
npm run dist                  # rollup: UMD bundles in dist/

mkdir -p "$out/types"
cp dist/imgui.umd.js dist/imgui_impl.umd.js dist/imgui_demo.umd.js "$out/"
cp build/imgui.d.ts build/bind-imgui.d.ts build/emscripten.d.ts "$out/types/"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ imgui: process.argv[2], imguiJs: process.argv[3], emscripten: process.argv[4] }, null, 2) + "\n")' \
  "$out/build-info.json" \
  "$(grep -m1 -oP '#define IMGUI_VERSION\s+"\K[^"]+' imgui/imgui.h)" \
  "$(git rev-parse --short HEAD)" \
  "$(emcc --version | head -1)"
ls -la "$out" "$out/types"
