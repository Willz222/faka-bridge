#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/worker" "$dist_root/migrations"
cp "$project_root/worker/index.js" "$dist_root/worker/index.js"
cp "$project_root"/migrations/*.sql "$dist_root/migrations/"
cp "$project_root/.dev.vars.example" "$dist_root/.dev.vars.example"
cp "$project_root/wrangler.jsonc" "$dist_root/wrangler.jsonc"
cp "$project_root/README.md" "$dist_root/README.md"

echo "Built $dist_root"
