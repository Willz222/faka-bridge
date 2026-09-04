#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"
release_file="$project_root/release/faka-bridge-worker-v0.3.0.txt"

rm -rf "$dist_root"
mkdir -p "$dist_root/worker" "$dist_root/server" "$dist_root/migrations" "$dist_root/.openai/drizzle" "$dist_root/acg-plugin"
cp "$project_root/worker/index.js" "$dist_root/worker/index.js"
cp "$project_root/worker/index.js" "$dist_root/server/index.js"
cp "$project_root/worker/index.js" "$release_file"
cp "$project_root"/migrations/*.sql "$dist_root/migrations/"
cp "$project_root"/migrations/*.sql "$dist_root/.openai/drizzle/"
cp -R "$project_root/acg-plugin/." "$dist_root/acg-plugin/"
cp "$project_root/.dev.vars.example" "$dist_root/.dev.vars.example"
cp "$project_root/wrangler.jsonc" "$dist_root/wrangler.jsonc"
cp "$project_root/README.md" "$dist_root/README.md"
cp "$project_root/UPGRADE-v0.3.0.md" "$dist_root/UPGRADE-v0.3.0.md"
cp "$project_root/CHANGELOG.md" "$dist_root/CHANGELOG.md"
cp "$project_root/SECURITY.md" "$dist_root/SECURITY.md"
cp "$project_root/LICENSE" "$dist_root/LICENSE"

echo "Built $dist_root"
