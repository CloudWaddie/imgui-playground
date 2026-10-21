(async function () {
  const out = document.createElement("pre");
  out.id = "ac-result";
  document.body.appendChild(out);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    while (!window.monaco || !monaco.editor.getEditors().length) await wait(200);
    const ts = monaco.languages.typescript;
    while (!Object.keys(ts.javascriptDefaults.getExtraLibs()).some((k) => k.includes("globals"))) await wait(200);
    await wait(1500);
    const editor = monaco.editor.getEditors()[0];
    const variants = {
      "undeclared (user's code)": 'function frame() {\n  dl = ImGui.GetForegroundDrawList();\n  dl.\n}\n',
      "const": 'function frame() {\n  const dl = ImGui.GetForegroundDrawList();\n  dl.\n}\n',
    };
    for (const [name, code] of Object.entries(variants)) {
      editor.setValue(code);
      const model = editor.getModel();
      const idx = code.indexOf("dl.\n") + 3;
      const pos = model.getPositionAt(idx);
      const worker = await (await ts.getJavaScriptWorker())(model.uri);
      const res = await worker.getCompletionsAtPosition(model.uri.toString(), idx);
      const names = (res && res.entries || []).map((e) => e.name);
      out.textContent += name + ": " + names.length + " completions" + (names.length ? " e.g. " + names.slice(0, 5).join(", ") + " | has AddRectFilled: " + names.includes("AddRectFilled") : "") + "\n";
    }
  } catch (e) {
    out.textContent += "ERROR " + e.message;
  }
  out.textContent += "DONE";
})();
