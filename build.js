#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = __dirname;
const inputHtml = path.join(root, 'index.dev.html');
const cssPath = path.join(root, 'styles.css');
const outputDir = path.join(root, 'dist');
const outputHtml = path.join(outputDir, 'index.html');
const standaloneHtml = path.join(root, 'index.html');

const moduleOrder = [
  'src/state/default-state.js',
  'src/core/life-rule.js',
  'src/core/life-automaton.js',
  'src/core/magnet.js',
  'src/core/particle-system.js',
  'src/core/ferro-simulation.js',
  'src/modes/simulation-mode.js',
  'src/modes/interactive-mode.js',
  'src/modes/life-mode.js',
  'src/modes/game-mode.js',
  'src/modes/screensaver-mode.js',
  'src/ui/tab-manager.js',
  'src/ui/controls.js',
  'src/main.js',
];

function stripModules(source) {
  let code = source;
  code = code.replace(/import[^;]+;\s*/g, '');
  code = code.replace(/export\s+class\s+/g, 'class ');
  code = code.replace(/export\s+function\s+/g, 'function ');
  code = code.replace(/export\s+const\s+/g, 'const ');
  code = code.replace(/export\s+let\s+/g, 'let ');
  code = code.replace(/export\s+var\s+/g, 'var ');
  code = code.replace(/export\s+default\s+/g, '');
  code = code.replace(/export\s*{[^}]+};?/g, '');
  return code.trim();
}

function build() {
  const html = fs.readFileSync(inputHtml, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  const bundle = moduleOrder
    .map((file) => {
      const absolute = path.join(root, file);
      const source = fs.readFileSync(absolute, 'utf8');
      return stripModules(source);
    })
    .join('\n\n');

  const inlineCss = `<style>\n${css}\n</style>`;
  const inlineScript = `<script>\n(() => {\n${bundle}\n})();\n</script>`;

  const htmlWithCss = html.replace(/<link rel="stylesheet" href="styles.css" \/>/, inlineCss);
  const finalHtml = htmlWithCss.replace(
    /<script[^>]*src="src\/main.js"[^>]*><\/script>/,
    inlineScript,
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputHtml, finalHtml, 'utf8');
  fs.writeFileSync(standaloneHtml, finalHtml, 'utf8');
  console.log(`Built ${outputHtml}`);
  console.log(`Standalone bundle written to ${standaloneHtml}`);
}

build();
