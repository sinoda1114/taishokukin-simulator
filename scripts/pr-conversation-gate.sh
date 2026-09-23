#!/usr/bin/env bash
set -euo pipefail

# PR の未解決レビュー会話ゲート。
#   scripts/pr-conversation-gate.sh [--pr N]              未解決があれば exit 1
#   scripts/pr-conversation-gate.sh --resolve-safe        outdated / 返信ありを Resolve
#   scripts/pr-conversation-gate.sh --resolve-all         対応後の残りを全部 Resolve

MODE="check"
PR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      PR="${2:-}"
      shift 2
      ;;
    --resolve-safe)
      MODE="safe"
      shift
      ;;
    --resolve-all)
      MODE="all"
      shift
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$PR" ]]; then
  PR="$(gh pr view --json number --jq .number)"
fi

QUERY='query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          comments(first: 20) {
            totalCount
            nodes { databaseId author { login } }
          }
        }
      }
    }
  }
}'

PAYLOAD="$(gh api graphql -f query="$QUERY" -F owner=sinoda1114 -F name=taishokukin-simulator -F number="$PR")"

python3 - "$MODE" "$PR" "$PAYLOAD" <<'PY'
import json, os, subprocess, sys

mode, pr, raw = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.loads(raw)
nodes = (
    data.get("data", {})
    .get("repository", {})
    .get("pullRequest", {})
    .get("reviewThreads", {})
    .get("nodes")
    or []
)
open_threads = [t for t in nodes if not t.get("isResolved")]

def resolve(thread_id: str) -> None:
    mutation = """
    mutation($id: ID!) {
      resolveReviewThread(input: { threadId: $id }) {
        thread { isResolved }
      }
    }
    """
    subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={mutation}", "-f", f"id={thread_id}"],
        check=True,
        stdout=subprocess.DEVNULL,
    )

if mode == "check":
    if not open_threads:
        print(f"PR #{pr}: unresolved review conversations: 0")
        sys.exit(0)
    print(f"PR #{pr}: unresolved review conversations: {len(open_threads)}")
    for t in open_threads:
        comments = t.get("comments", {}).get("nodes") or []
        authors = ", ".join(
            (c.get("author") or {}).get("login") or "?" for c in comments[:3]
        )
        print(f"  - {t['id']} outdated={t.get('isOutdated')} authors={authors}")
    sys.exit(1)

to_close = []
for t in open_threads:
    replies = (t.get("comments") or {}).get("totalCount") or 0
    if mode == "all" or t.get("isOutdated") or replies > 1:
        to_close.append(t)

for t in to_close:
    resolve(t["id"])
    print(f"resolved {t['id']}")

left = len(open_threads) - len(to_close)
print(f"PR #{pr}: resolved {len(to_close)}, still open {left}")
sys.exit(0 if left == 0 else 1)
PY
