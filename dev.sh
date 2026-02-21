touch .env

if ! grep -q "^export PORT=" .env; then
  PORT=$(
    od -An -N2 -tu2 /dev/urandom |
    tr -d ' ' |
    awk '{print 50000 + ($1 % 10000)}'
  )
  printf 'export PORT=%s\n' "$PORT" >> .env
fi

. ./.env

echo "https://port-$PORT.jamtools.dev"

pnpm i

# if [ ! -d node_modules ]; then
#   pnpm i
# fi

# npm run dev

npm run storybook