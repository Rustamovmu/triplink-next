#!/bin/bash
set -euo pipefail

cd /Users/a1234/Developer/tripLInk-next
git checkout master
git pull --ff-only origin master
docker compose up -d --force-recreate