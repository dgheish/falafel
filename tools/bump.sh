#!/usr/bin/env bash
# Raise the site version after changing anything in js/, css/ or content/.
# Usage: tools/bump.sh   (run from the repository root)
set -euo pipefail
old=$(grep -o '"v": [0-9]*' version.json | grep -o '[0-9]*')
new=$((old + 1))
echo "{ \"v\": $new }" > version.json
sed -i "s/?v=$old/?v=$new/g" index.html js/app.js js/audio.js
sed -i "s/^const VERSION = $old;/const VERSION = $new;/" js/app.js
echo "version $old -> $new"
