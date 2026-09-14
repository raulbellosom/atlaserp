#!/bin/sh
set -e

# Write runtime-config.js for the React app
cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__RUNLY_RUNTIME_CONFIG__ = {
  "RUNLY_API_URL": "${RUNLY_API_URL:-}",
  "SUPABASE_URL": "${SUPABASE_URL:-}",
  "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY:-}"
};
EOF


exec nginx -g 'daemon off;'
