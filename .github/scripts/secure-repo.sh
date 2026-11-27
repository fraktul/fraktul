#!/usr/bin/env bash
# Applies the repository's security settings with the GitHub CLI, so they are written down and can be re-applied:
#   .github/scripts/secure-repo.sh [owner/repo]        (default: the checkout's repository; needs admin rights)
#
# Run it once now and again right after the repository becomes public: on a private repository of a free
# organization GitHub refuses rulesets, secret scanning, private vulnerability reporting and fork approval, and this
# script says which ones it had to skip. It only ever tightens settings, and running it twice changes nothing.
#
# What it sets (the same shape as bascikdev/bascik):
#   - main:  no deletion, no force push, changes only through a pull request with one approval from a code owner
#            (.github/CODEOWNERS) and a passing "Test" check. Repository admins can bypass, so a sole maintainer
#            can still merge their own pull requests.
#   - tags:  v* tags (which publish to npm) can only be created, moved or deleted by an admin.
#   - Actions: only GitHub's own actions may run; the workflow token is read-only by default and cannot approve
#            pull requests; workflows on pull requests from outside contributors wait for a maintainer's approval.
#   - Secret scanning with push protection, Dependabot alerts and security updates, private vulnerability reports.
set -uo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
ADMIN_ID="$(gh api user -q .id)"
VISIBILITY="$(gh api "repos/$REPO" -q .visibility)"
echo "Securing $REPO ($VISIBILITY), admin bypass for $(gh api user -q .login)"
skipped=()

# Runs one setting; a refusal that only a public repository lifts is recorded, anything else is shown.
apply() {
  local label="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then echo "  ok       $label"; return 0; fi
  if [ "$VISIBILITY" != "public" ] && grep -qiE 'make this repository public|not allowed for private|Advanced Security|is not available|must be public|Upgrade to|Not Found' <<<"$out"; then
    echo "  skipped  $label (needs a public repository)"; skipped+=("$label"); return 0
  fi
  echo "  FAILED   $label: $(head -c 300 <<<"$out")"; return 1
}

# Creates the ruleset, or updates the one with the same name.
ruleset() {
  local name="$1" body="$2" list id
  # Listing fails on a private repository of a free organization: pass GitHub's refusal on, so it is reported as such.
  if ! list="$(gh api "repos/$REPO/rulesets" 2>&1)"; then echo "$list"; return 1; fi
  id="$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' <<<"$list" | head -1)"
  if [ -n "$id" ]; then gh api -X PUT "repos/$REPO/rulesets/$id" --input - <<<"$body" >/dev/null
  else gh api -X POST "repos/$REPO/rulesets" --input - <<<"$body" >/dev/null; fi
}

apply "merged branches are deleted; no wiki; no auto-merge" \
  gh api -X PATCH "repos/$REPO" -F delete_branch_on_merge=true -F has_wiki=false -F allow_auto_merge=false

apply "Actions: only GitHub's own actions" \
  gh api -X PUT "repos/$REPO/actions/permissions" -F enabled=true -f allowed_actions=selected
apply "Actions: allowed list (github-owned, nothing else)" \
  gh api -X PUT "repos/$REPO/actions/permissions/selected-actions" --input - <<<'{"github_owned_allowed":true,"verified_allowed":false,"patterns_allowed":[]}'
apply "Actions: read-only token, cannot approve pull requests" \
  gh api -X PUT "repos/$REPO/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
apply "Actions: outside contributors' pull requests wait for approval" \
  gh api -X PUT "repos/$REPO/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors

apply "Dependabot alerts" gh api -X PUT "repos/$REPO/vulnerability-alerts"
apply "Dependabot security updates" gh api -X PUT "repos/$REPO/automated-security-fixes"
apply "private vulnerability reporting" gh api -X PUT "repos/$REPO/private-vulnerability-reporting"
apply "secret scanning with push protection" \
  gh api -X PATCH "repos/$REPO" --input - <<<'{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}'

apply "ruleset: Protect Main" ruleset "Protect Main" "$(cat <<JSON
{
  "name": "Protect Main", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": $ADMIN_ID, "actor_type": "User", "bypass_mode": "always" }],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_status_checks", "parameters": { "required_status_checks": [{ "context": "Test" }], "strict_required_status_checks_policy": false, "do_not_enforce_on_create": false } },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 1, "require_code_owner_review": true, "dismiss_stale_reviews_on_push": false, "require_last_push_approval": false, "required_review_thread_resolution": false, "allowed_merge_methods": ["merge", "squash", "rebase"] } }
  ]
}
JSON
)"
apply "ruleset: Tag Rules (v*)" ruleset "Tag Rules" "$(cat <<JSON
{
  "name": "Tag Rules", "target": "tag", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": $ADMIN_ID, "actor_type": "User", "bypass_mode": "always" }],
  "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }, { "type": "creation" }, { "type": "update" }]
}
JSON
)"

echo
if [ "${#skipped[@]}" -gt 0 ]; then
  echo "${#skipped[@]} setting(s) need a public repository. After making it public, run this script again:"
  printf '  - %s\n' "${skipped[@]}"
else
  echo "Every setting is applied."
fi
