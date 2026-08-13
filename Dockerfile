# Build + run the Cameo notifier under Bun. Added so the app builds via a plain
# Dockerfile on the NAS build server (nixpacks' pinned-nixpkgs plan fails to
# evaluate under nas-builder's nix).
FROM oven/bun:1.3
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
