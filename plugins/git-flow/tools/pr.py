#!/usr/bin/env python3
"""Git PR Operations - Create, view, and manage pull requests.

Uses GitHub CLI (gh) for all PR operations.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Import registry from same package
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))
from registry import update_worktree, find_by_branch


def check_gh_installed() -> bool:
    """Check if gh CLI is installed and authenticated.

    Returns:
        True if gh is available and authenticated
    """
    try:
        result = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def get_current_branch() -> Optional[str]:
    """Get the current branch name.

    Returns:
        Branch name or None
    """
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        return result.stdout.strip()
    return None


def get_repo_info() -> dict:
    """Get current repository info.

    Returns:
        Dict with owner, repo, default_branch
    """
    # Get remote URL
    result = subprocess.run(
        ["gh", "repo", "view", "--json", "owner,name,defaultBranchRef"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            return {
                "owner": data.get("owner", {}).get("login", ""),
                "repo": data.get("name", ""),
                "default_branch": data.get("defaultBranchRef", {}).get("name", "main")
            }
        except json.JSONDecodeError:
            pass

    return {"owner": "", "repo": "", "default_branch": "main"}


def get_pr_info(branch: str = None) -> Optional[dict]:
    """Get PR info for a branch.

    Args:
        branch: Branch name (defaults to current branch)

    Returns:
        PR info dict or None if no PR exists
    """
    branch = branch or get_current_branch()
    if not branch:
        return None

    result = subprocess.run(
        [
            "gh", "pr", "view", branch,
            "--json", "number,state,url,title,body,headRefName,baseRefName,isDraft,mergeable,reviewDecision"
        ],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            pass

    return None


def create_pr(
    title: str,
    body: str = "",
    base: str = "develop",
    draft: bool = False,
    labels: list[str] = None,
    assignees: list[str] = None
) -> dict:
    """Create a pull request.

    Args:
        title: PR title
        body: PR body/description
        base: Base branch (default: develop)
        draft: Create as draft PR
        labels: Labels to add
        assignees: Users to assign

    Returns:
        Dict with PR info or error
    """
    if not check_gh_installed():
        return {"error": "gh CLI not installed or not authenticated"}

    branch = get_current_branch()
    if not branch:
        return {"error": "Not on a git branch"}

    # Check for existing PR
    existing = get_pr_info(branch)
    if existing:
        return {
            "error": "PR already exists",
            "existing_pr": existing
        }

    # Build command
    cmd = ["gh", "pr", "create", "--base", base, "--title", title]

    if body:
        cmd.extend(["--body", body])
    else:
        cmd.append("--fill")

    if draft:
        cmd.append("--draft")

    if labels:
        for label in labels:
            cmd.extend(["--label", label])

    if assignees:
        for assignee in assignees:
            cmd.extend(["--assignee", assignee])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return {"error": result.stderr.strip()}

    # Get created PR info
    pr_url = result.stdout.strip()
    pr_info = get_pr_info(branch)

    # Update registry
    worktree = find_by_branch(branch)
    if worktree and worktree.get("session_id"):
        update_worktree(worktree["session_id"], {"pr_url": pr_url})

    return {
        "url": pr_url,
        "branch": branch,
        "base": base,
        "title": title,
        "draft": draft,
        "pr_info": pr_info
    }


def list_prs(
    state: str = "open",
    author: str = None,
    label: str = None,
    base: str = None,
    limit: int = 30
) -> list[dict]:
    """List pull requests.

    Args:
        state: PR state (open, closed, merged, all)
        author: Filter by author
        label: Filter by label
        base: Filter by base branch
        limit: Max number of PRs to return

    Returns:
        List of PR info dicts
    """
    cmd = [
        "gh", "pr", "list",
        "--state", state,
        "--limit", str(limit),
        "--json", "number,title,state,url,headRefName,baseRefName,author,createdAt,isDraft"
    ]

    if author:
        cmd.extend(["--author", author])
    if label:
        cmd.extend(["--label", label])
    if base:
        cmd.extend(["--base", base])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            pass

    return []


def merge_pr(
    pr_number: int = None,
    method: str = "squash",
    delete_branch: bool = True,
    admin: bool = False
) -> dict:
    """Merge a pull request.

    Args:
        pr_number: PR number (defaults to current branch's PR)
        method: Merge method (merge, squash, rebase)
        delete_branch: Delete branch after merge
        admin: Use admin privileges to merge

    Returns:
        Dict with merge result
    """
    if not check_gh_installed():
        return {"error": "gh CLI not installed or not authenticated"}

    # Get PR if number not specified
    if pr_number is None:
        pr_info = get_pr_info()
        if not pr_info:
            return {"error": "No PR found for current branch"}
        pr_number = pr_info.get("number")

    # Build command
    cmd = ["gh", "pr", "merge", str(pr_number), f"--{method}"]

    if delete_branch:
        cmd.append("--delete-branch")

    if admin:
        cmd.append("--admin")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return {"error": result.stderr.strip()}

    # Update registry
    branch = get_current_branch()
    if branch:
        worktree = find_by_branch(branch)
        if worktree and worktree.get("session_id"):
            from registry import mark_merged
            mark_merged(worktree["session_id"])

    return {
        "merged": True,
        "pr_number": pr_number,
        "method": method,
        "branch_deleted": delete_branch
    }


def close_pr(pr_number: int = None, comment: str = None) -> dict:
    """Close a pull request without merging.

    Args:
        pr_number: PR number (defaults to current branch's PR)
        comment: Optional closing comment

    Returns:
        Dict with close result
    """
    if pr_number is None:
        pr_info = get_pr_info()
        if not pr_info:
            return {"error": "No PR found for current branch"}
        pr_number = pr_info.get("number")

    cmd = ["gh", "pr", "close", str(pr_number)]

    if comment:
        cmd.extend(["--comment", comment])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return {"error": result.stderr.strip()}

    return {"closed": True, "pr_number": pr_number}


def add_reviewers(pr_number: int = None, reviewers: list[str] = None) -> dict:
    """Add reviewers to a pull request.

    Args:
        pr_number: PR number
        reviewers: List of GitHub usernames

    Returns:
        Dict with result
    """
    if not reviewers:
        return {"error": "No reviewers specified"}

    if pr_number is None:
        pr_info = get_pr_info()
        if not pr_info:
            return {"error": "No PR found for current branch"}
        pr_number = pr_info.get("number")

    cmd = ["gh", "pr", "edit", str(pr_number)]
    for reviewer in reviewers:
        cmd.extend(["--add-reviewer", reviewer])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return {"error": result.stderr.strip()}

    return {"pr_number": pr_number, "reviewers_added": reviewers}


def get_checks_status(pr_number: int = None) -> dict:
    """Get CI/CD check status for a PR.

    Args:
        pr_number: PR number

    Returns:
        Dict with check statuses
    """
    if pr_number is None:
        pr_info = get_pr_info()
        if not pr_info:
            return {"error": "No PR found for current branch"}
        pr_number = pr_info.get("number")

    result = subprocess.run(
        ["gh", "pr", "checks", str(pr_number), "--json", "name,state,conclusion"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        try:
            checks = json.loads(result.stdout)
            # Summarize
            passed = sum(1 for c in checks if c.get("conclusion") == "success")
            failed = sum(1 for c in checks if c.get("conclusion") == "failure")
            pending = sum(1 for c in checks if c.get("state") == "pending")

            return {
                "pr_number": pr_number,
                "checks": checks,
                "summary": {
                    "total": len(checks),
                    "passed": passed,
                    "failed": failed,
                    "pending": pending,
                    "all_passed": failed == 0 and pending == 0 and passed > 0
                }
            }
        except json.JSONDecodeError:
            pass

    return {"pr_number": pr_number, "checks": [], "summary": {}}


def generate_pr_body(commits: list[dict], files: list[str]) -> str:
    """Generate a PR body from commits and changed files.

    Args:
        commits: List of commit info dicts
        files: List of changed file paths

    Returns:
        Formatted PR body
    """
    body = "## Summary\n\n"

    # Group commits by type
    features = []
    fixes = []
    other = []

    for c in commits:
        msg = c.get("message", "")
        if msg.startswith("feat") or "add" in msg.lower():
            features.append(msg)
        elif msg.startswith("fix") or "bug" in msg.lower():
            fixes.append(msg)
        else:
            other.append(msg)

    if features:
        body += "### Features\n"
        for f in features[:5]:
            body += f"- {f[:80]}\n"
        body += "\n"

    if fixes:
        body += "### Fixes\n"
        for f in fixes[:5]:
            body += f"- {f[:80]}\n"
        body += "\n"

    if other:
        body += "### Other Changes\n"
        for o in other[:5]:
            body += f"- {o[:80]}\n"
        body += "\n"

    # File summary
    body += "## Files Changed\n\n"
    body += f"Total: {len(files)} files\n\n"

    if files:
        # Group by directory
        dirs = {}
        for f in files:
            d = str(Path(f).parent)
            if d not in dirs:
                dirs[d] = []
            dirs[d].append(Path(f).name)

        for d, fnames in sorted(dirs.items())[:10]:
            body += f"- `{d}/`: {', '.join(fnames[:3])}"
            if len(fnames) > 3:
                body += f" +{len(fnames) - 3} more"
            body += "\n"

    body += "\n## Test Plan\n\n"
    body += "- [ ] Tests pass locally\n"
    body += "- [ ] Manual testing completed\n"
    body += "- [ ] Documentation updated (if needed)\n"

    return body


# CLI interface
def main():
    parser = argparse.ArgumentParser(description="GitHub PR operations")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # create
    create_parser = subparsers.add_parser("create", help="Create PR")
    create_parser.add_argument("--title", "-t", required=True, help="PR title")
    create_parser.add_argument("--body", "-b", help="PR body")
    create_parser.add_argument("--base", default="develop", help="Base branch")
    create_parser.add_argument("--draft", action="store_true", help="Create as draft")
    create_parser.add_argument("--label", action="append", help="Add label")
    create_parser.add_argument("--assignee", action="append", help="Add assignee")

    # view
    view_parser = subparsers.add_parser("view", help="View PR")
    view_parser.add_argument("--branch", "-b", help="Branch name")

    # list
    list_parser = subparsers.add_parser("list", help="List PRs")
    list_parser.add_argument("--state", default="open", choices=["open", "closed", "merged", "all"])
    list_parser.add_argument("--author", help="Filter by author")
    list_parser.add_argument("--label", help="Filter by label")
    list_parser.add_argument("--base", help="Filter by base branch")
    list_parser.add_argument("--limit", type=int, default=30, help="Max results")
    list_parser.add_argument("--format", choices=["json", "table"], default="table")

    # merge
    merge_parser = subparsers.add_parser("merge", help="Merge PR")
    merge_parser.add_argument("--number", "-n", type=int, help="PR number")
    merge_parser.add_argument("--method", default="squash", choices=["merge", "squash", "rebase"])
    merge_parser.add_argument("--no-delete", action="store_true", help="Don't delete branch")
    merge_parser.add_argument("--admin", action="store_true", help="Use admin privileges")

    # close
    close_parser = subparsers.add_parser("close", help="Close PR")
    close_parser.add_argument("--number", "-n", type=int, help="PR number")
    close_parser.add_argument("--comment", "-c", help="Closing comment")

    # checks
    checks_parser = subparsers.add_parser("checks", help="View check status")
    checks_parser.add_argument("--number", "-n", type=int, help="PR number")

    # reviewers
    rev_parser = subparsers.add_parser("add-reviewers", help="Add reviewers")
    rev_parser.add_argument("--number", "-n", type=int, help="PR number")
    rev_parser.add_argument("reviewers", nargs="+", help="Reviewer usernames")

    # status (check gh auth)
    status_parser = subparsers.add_parser("status", help="Check gh status")

    args = parser.parse_args()

    if args.command == "create":
        result = create_pr(
            title=args.title,
            body=args.body or "",
            base=args.base,
            draft=args.draft,
            labels=args.label,
            assignees=args.assignee
        )
        print(json.dumps(result, indent=2))
        if "error" in result:
            sys.exit(1)

    elif args.command == "view":
        pr_info = get_pr_info(args.branch)
        if pr_info:
            print(json.dumps(pr_info, indent=2))
        else:
            print(json.dumps({"error": "No PR found"}))
            sys.exit(1)

    elif args.command == "list":
        prs = list_prs(
            state=args.state,
            author=args.author,
            label=args.label,
            base=args.base,
            limit=args.limit
        )
        if args.format == "json":
            print(json.dumps(prs, indent=2))
        else:
            if not prs:
                print("No PRs found")
            else:
                print(f"{'#':<6} {'Title':<50} {'Branch':<30} {'State':<10}")
                print("-" * 100)
                for pr in prs:
                    num = str(pr.get("number", ""))
                    title = pr.get("title", "")[:48]
                    branch = pr.get("headRefName", "")[:28]
                    state = pr.get("state", "")
                    if pr.get("isDraft"):
                        state = "draft"
                    print(f"{num:<6} {title:<50} {branch:<30} {state:<10}")

    elif args.command == "merge":
        result = merge_pr(
            pr_number=args.number,
            method=args.method,
            delete_branch=not args.no_delete,
            admin=args.admin
        )
        print(json.dumps(result, indent=2))
        if "error" in result:
            sys.exit(1)

    elif args.command == "close":
        result = close_pr(pr_number=args.number, comment=args.comment)
        print(json.dumps(result, indent=2))
        if "error" in result:
            sys.exit(1)

    elif args.command == "checks":
        result = get_checks_status(args.number)
        print(json.dumps(result, indent=2))

    elif args.command == "add-reviewers":
        result = add_reviewers(pr_number=args.number, reviewers=args.reviewers)
        print(json.dumps(result, indent=2))
        if "error" in result:
            sys.exit(1)

    elif args.command == "status":
        if check_gh_installed():
            repo = get_repo_info()
            print(json.dumps({
                "gh_installed": True,
                "authenticated": True,
                "repo": repo
            }, indent=2))
        else:
            print(json.dumps({
                "gh_installed": False,
                "authenticated": False,
                "error": "gh CLI not installed or not authenticated. Run: gh auth login"
            }, indent=2))
            sys.exit(1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
