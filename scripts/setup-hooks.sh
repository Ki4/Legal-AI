#!/bin/bash
# Устанавливает git-хуки из scripts/hooks/ в .git/hooks/
# Запуск: bash scripts/setup-hooks.sh

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/scripts/hooks"
HOOKS_DEST="$REPO_ROOT/.git/hooks"

for hook in "$HOOKS_SRC"/*; do
    name=$(basename "$hook")
    cp "$hook" "$HOOKS_DEST/$name"
    chmod +x "$HOOKS_DEST/$name"
    echo "Installed: .git/hooks/$name"
done

echo "Done. Git hooks installed."
