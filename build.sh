#!/usr/bin/env bash
# בונה את האתר לתיקיית docs/ — זו התיקייה ש‑GitHub Pages מגיש.
set -e
cd "$(dirname "$0")"
rm -rf docs && mkdir -p docs
npx tsc src/app.jsx --allowJs --jsx react --target es2017 --outDir docs --skipLibCheck --noEmitOnError false || true
cp src/index.html src/styles.css src/logic.js src/manifest.json src/*.png docs/
[ -f docs/firebase-config.js ] || cp src/firebase-config.js docs/
touch docs/.nojekyll
node tests/logic.test.js
echo "✔ docs/ מוכן"
