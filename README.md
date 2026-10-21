# ImGui Playground

Write [Dear ImGui](https://github.com/ocornut/imgui) code in the browser and watch it hot-reload, no C++ toolchain required.

Live at **https://imgui.cloudwaddie.com**

- Dear ImGui 1.92.8 compiled with Emscripten, through [jsimgui](https://github.com/mori2003/jsimgui) (built from [CloudWaddie/jsimgui](https://github.com/CloudWaddie/jsimgui))
- The editor is [Monaco](https://github.com/microsoft/monaco-editor) (the editor VS Code is built on), with ImGui autocomplete from the jsimgui typings
- Draw lists, the native `ShowDemoWindow`, tables, multi-select, and fonts at any size
- Follows Dear ImGui's master branch: docking is not available

## Writing code

Define a `frame()` function. It runs every frame. Top-level code runs once each time you apply, so top-level variables reset when you edit.

```js
const show = [true];

function frame() {
  ImGui.Begin("Hello");
  ImGui.Checkbox("Show demo", show);
  ImGui.End();
  if (show[0]) ImGui.ShowDemoWindow(show);
}
```

- Where C++ takes a pointer (`&value`), pass a one-element array (`[value]`) and read it back as `value[0]`.
- Types and enums are globals, as in C++: `ImVec2`, `ImVec4`, `ImGuiCond.FirstUseEver`, `ImGuiWindowFlags.NoTitleBar`, and `IM_COL32(r, g, b, a)` for draw-list colors.
- C++ overloads work as written: `ImGui.SetWindowPos("name", pos)`, `ImGui.PushStyleColor(idx, ImVec4)`, `ImGui.PushFont(font, size)`.
- A failed `IM_ASSERT` is reported in the status bar with the line that caused it. The page keeps running.

## Fonts and images

Add `.ttf`/`.otf` fonts and images from the **Assets** panel, or drop them anywhere on the page. They're kept in your browser (IndexedDB) and available to your code as `assets`:

```js
const title = assets.font("Inter.ttf"); // ImFont
const logo = assets.image("logo.png");  // { ref, width, height, size }

function frame() {
  ImGui.Begin("Assets");
  ImGui.PushFont(title, 28); // any size, even one that changes every frame
  ImGui.Text("Hello");
  ImGui.PopFont();
  ImGui.Image(logo.ref, logo.size);
  ImGui.End();
}
```

## Dear ImGui versions

The version label next to the title becomes a picker when there's more than one build. Each entry in `imgui-versions.json` names a branch of a jsimgui repository plus the Emscripten and Node versions to build it with. The Pages workflow compiles each one with `scripts/build-jsimgui.sh`, caches it by commit, and publishes it under `lib/<version>/`.

## Running locally

It's a static site: serve the folder (`python -m http.server`). Without a CI build in `lib/`, it loads the same jsimgui release from npm.
