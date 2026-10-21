# ImGui Playground

Write [Dear ImGui](https://github.com/ocornut/imgui) code in the browser and watch it hot-reload, no C++ toolchain required.

Live at **https://imgui.cloudwaddie.com**

- Dear ImGui runs as WebAssembly through [flyover/imgui-js](https://github.com/flyover/imgui-js)
- The editor is [Monaco](https://github.com/microsoft/monaco-editor) (the editor VS Code is built on), with ImGui autocomplete from the imgui-js typings
- Draw lists (`GetWindowDrawList`, `GetBackgroundDrawList`, `GetForegroundDrawList`) and the ported `ShowDemoWindow` are available

## Writing code

Define a `frame()` function. It runs every frame. Top-level code runs once each time you apply, so top-level variables reset when you edit.

```js
let show = true;

function frame() {
  ImGui.Begin("Hello");
  ImGui.Checkbox("Show demo", (v = show) => show = v);
  ImGui.End();
  if (show) ImGui.ShowDemoWindow((v = show) => show = v);
}
```

Where C++ takes a pointer (`&value`), imgui-js takes an accessor: `(v = value) => value = v`.

## Running locally

It's a static site. Open `index.html` directly, or serve the folder (`python -m http.server`).
