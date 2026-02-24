#!/bin/bash
set -euo pipefail

# ─── Specbook Desktop: Build & Release Script ───────────────────
# Reads version from @specbook/desktop/package.json, builds the app,
# and creates a GitHub release with DMG and ZIP artifacts.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/packages/desktop"
DIST_DIR="$DESKTOP_DIR/dist"

# 1. Read version
VERSION=$(node -e "console.log(require('$DESKTOP_DIR/package.json').version)")
TAG="v$VERSION"

echo "🚀 Specbook Release: $TAG"
echo "────────────────────────────"

# 2. Ensure clean working tree
if ! git -C "$ROOT_DIR" diff --quiet || ! git -C "$ROOT_DIR" diff --cached --quiet; then
    echo "❌ Working tree is dirty. Please commit or stash your changes before releasing."
    exit 1
fi
echo "✅ Working tree is clean"

# 2. Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Install with: brew install gh"
    exit 1
fi

# 3. Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI not authenticated. Run: gh auth login"
    exit 1
fi
echo "✅ GitHub CLI authenticated"

# 3. Check if tag already exists on remote
if gh release view "$TAG" &> /dev/null; then
    echo "⚠️  Release $TAG already exists. Delete it first or bump the version."
    echo "   To delete: gh release delete $TAG --yes && git push origin :$TAG"
    exit 1
fi

# 4. Check if artifacts already exist (skip build if so)
ARM_DMG="$DIST_DIR/Specbook-${VERSION}-mac-arm64.dmg"
X64_DMG="$DIST_DIR/Specbook-${VERSION}-mac-x64.dmg"

if [[ -f "$ARM_DMG" && -f "$X64_DMG" ]]; then
    echo ""
    echo "⏭️  Artifacts for v${VERSION} already exist, skipping build..."
else
    echo ""
    echo "📦 Building shared + ai + desktop..."
    pnpm --filter @specbook/shared run build
    pnpm --filter @specbook/ai run build

    echo ""
    echo "🔨 Packaging macOS app..."
    pnpm --filter @specbook/desktop run dist
fi

# 5. Collect artifacts
echo ""
echo "📋 Artifacts:"
ARTIFACTS=()
for f in "$DIST_DIR"/*.dmg "$DIST_DIR"/*.zip; do
    if [[ -f "$f" ]]; then
        SIZE=$(du -h "$f" | cut -f1 | xargs)
        echo "   $(basename "$f")  ($SIZE)"
        ARTIFACTS+=("$f")
    fi
done

if [[ ${#ARTIFACTS[@]} -eq 0 ]]; then
    echo "❌ No DMG or ZIP files found in $DIST_DIR"
    exit 1
fi

# 6. Create GitHub release
echo ""
echo "🏷️  Creating GitHub release $TAG..."
gh release create "$TAG" \
    "${ARTIFACTS[@]}" \
    --title "Specbook $TAG" \
    --notes "## Specbook $TAG

### Downloads
- **Apple Silicon (M1/M2/M3)**: \`Specbook-${VERSION}-mac-arm64.dmg\`
- **Intel Mac**: \`Specbook-${VERSION}-mac-x64.dmg\`

### Installation
1. Download the DMG for your Mac architecture
2. Open the DMG and drag Specbook to Applications
3. On first launch: right-click → Open (required for unsigned apps)"

echo ""
echo "✅ Release $TAG published!"
echo "   https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
