#!/usr/bin/env python3
"""
Jarvis Git Command Execution Module
Executes validated CLI actions inside the project root directory.
Guarantees execution in the project directory regardless of caller CWD,
auto-injects GitHub CLI path, and skips execution for general QA queries.
"""

import sys
import os
import json
import re
import subprocess
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# Ensure GitHub CLI and Git are in PATH
GH_PATH = r"C:\Program Files\GitHub CLI"
if os.path.exists(GH_PATH) and GH_PATH not in os.environ.get("PATH", ""):
    os.environ["PATH"] = GH_PATH + os.pathsep + os.environ.get("PATH", "")

def handle_create_branch(target_repo: str, branch_name: str) -> tuple[int, str]:
    """Robustly checks out/creates a branch and pushes it to GitHub origin."""
    branch = branch_name.strip()
    if not branch:
        return 1, "Branch name is empty"
    print(f"[execute_git.py] Creating/switching to branch '{branch}'...")
    res = subprocess.run(["git", "checkout", "-b", branch], cwd=target_repo, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[execute_git.py] Notice on checkout -b: {res.stderr.strip()}; trying git checkout {branch}...")
        res2 = subprocess.run(["git", "checkout", branch], cwd=target_repo, capture_output=True, text=True)
        if res2.returncode != 0:
            err = res2.stderr.strip() or res.stderr.strip()
            return res2.returncode, f"Failed to checkout branch: {err}"

    print(f"[execute_git.py] Pushing branch '{branch}' to origin...")
    push_res = subprocess.run(["git", "push", "-u", "origin", branch], cwd=target_repo, capture_output=True, text=True)
    if push_res.returncode != 0:
        err = push_res.stderr.strip() or push_res.stdout.strip()
        return push_res.returncode, f"Failed to push branch to GitHub: {err}"

    return 0, f"Successfully created and pushed branch '{branch}' to GitHub"

def handle_commit_and_push(target_repo: str) -> tuple[int, str]:
    """Robustly stages, commits, and pushes to GitHub with accurate branch detection and syncing."""
    # 1. Stage all changes
    print("[execute_git.py] Staging changes: git add -A")
    subprocess.run(["git", "add", "-A"], cwd=target_repo, capture_output=True)

    # 2. Check if changes exist to commit
    status_proc = subprocess.run(["git", "status", "--porcelain"], cwd=target_repo, capture_output=True, text=True)
    if status_proc.stdout.strip():
        print("[execute_git.py] Committing changes...")
        commit_proc = subprocess.run(
            ["git", "commit", "-m", "Automated update via Jarvis"],
            cwd=target_repo,
            capture_output=True,
            text=True
        )
        if commit_proc.returncode != 0:
            err = commit_proc.stderr.strip() or commit_proc.stdout.strip()
            print(f"[execute_git.py] Commit note: {err}")
    else:
        print("[execute_git.py] Working tree clean, nothing new to commit.")

    # 3. Detect current branch
    br_proc = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=target_repo, capture_output=True, text=True)
    curr_branch = br_proc.stdout.strip() or "main"
    print(f"[execute_git.py] Current active branch: {curr_branch}")

    # 4. Push current branch to origin
    print(f"[execute_git.py] Pushing to origin/{curr_branch}...")
    push_proc = subprocess.run(
        ["git", "push", "-u", "origin", curr_branch],
        cwd=target_repo,
        capture_output=True,
        text=True
    )
    if push_proc.returncode != 0:
        err = push_proc.stderr.strip() or push_proc.stdout.strip()
        return push_proc.returncode, f"Git push error: {err}"

    # 5. Synchronize both main and master so GitHub default branch is always updated
    if curr_branch == "main":
        print("[execute_git.py] Syncing main to master on origin...")
        subprocess.run(["git", "push", "origin", "main:master"], cwd=target_repo, capture_output=True)
    elif curr_branch == "master":
        print("[execute_git.py] Syncing master to main on origin...")
        subprocess.run(["git", "push", "origin", "master:main"], cwd=target_repo, capture_output=True)

    return 0, f"Successfully pushed to GitHub ({curr_branch})"

def main():
    intent_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PROJECT_ROOT, "last_intent.json")
    if not os.path.exists(intent_file):
        print(f"[execute_git.py] Error: {intent_file} does not exist.", file=sys.stderr)
        sys.exit(1)

    try:
        with open(intent_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[execute_git.py] Invalid intent JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Delegate to execute_agent if Antigravity task
    if data.get("type") == "antigravity_task":
        print("[execute_git.py] Antigravity task detected; delegating to execute_agent.py.")
        agent_script = os.path.join(PROJECT_ROOT, "execute_agent.py")
        proc = subprocess.run([sys.executable, agent_script], cwd=PROJECT_ROOT)
        sys.exit(proc.returncode)

    # Bypass if query is General QA, Codebase QA, or Git Query
    if data.get("type") in ["general_qa", "codebase_qa", "git_query"]:
        print("[execute_git.py] QA/Query detected; bypassing Git CLI write actions.")
        sys.exit(0)

    action = str(data.get("action", "")).lower()
    command = data.get("command", "git status").strip()
    task_desc = data.get("task_description", "").lower()
    target_repo = os.getenv("TARGET_REPO_PATH", PROJECT_ROOT).strip()
    if target_repo == ".":
        target_repo = PROJECT_ROOT
    else:
        target_repo = os.path.abspath(target_repo)

    status_file = os.path.join(PROJECT_ROOT, "last_status.txt")

    # 1. Dedicated Handler for Branch Creation & Push
    if action == "create_branch" or "checkout -b" in command or ("branch" in task_desc and ("create" in task_desc or "make" in task_desc)):
        m = re.search(r'checkout\s+-b\s+([^\s&|]+)', command)
        if m:
            bname = m.group(1).strip()
        else:
            m2 = re.search(r'branch\s+([a-zA-Z0-9_\-\.\/]+)', task_desc)
            bname = m2.group(1).strip() if m2 else "feature-branch"
        print(f"[Jarvis Executing]: Robust Branch Creation '{bname}' in '{target_repo}'")
        retcode, out_msg = handle_create_branch(target_repo, bname)
        print(f"[execute_git.py] {out_msg} (Exit code: {retcode})")
        if retcode != 0:
            with open(status_file, "w", encoding="utf-8") as f:
                f.write(f"[GIT ERROR] {out_msg}")
            sys.exit(retcode)
        else:
            with open(status_file, "w", encoding="utf-8") as f:
                f.write(f"[GIT SUCCESS] {data.get('speaking_response', f'Branch {bname} created and pushed.')}")
            sys.exit(0)

    # 2. Dedicated Handler for Commit & Push
    elif "push" in command or "push" in task_desc or "commit" in task_desc:
        print(f"[Jarvis Executing]: Robust Git Commit & Push in '{target_repo}'")
        retcode, out_msg = handle_commit_and_push(target_repo)
        print(f"[execute_git.py] {out_msg} (Exit code: {retcode})")
        if retcode != 0:
            with open(status_file, "w", encoding="utf-8") as f:
                f.write(f"[GIT ERROR] {out_msg}")
            sys.exit(retcode)
        else:
            with open(status_file, "w", encoding="utf-8") as f:
                f.write(f"[GIT SUCCESS] {data.get('speaking_response', 'Git action completed.')}")
            sys.exit(0)

    print(f"[Jarvis Executing]: '{command}' in '{target_repo}'")

    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=target_repo,
            env=os.environ,
            capture_output=True,
            text=True
        )
        print(f"[execute_git.py] Process finished with exit code {proc.returncode}")
        if proc.stdout:
            print(f"[execute_git.py] Output:\n{proc.stdout.strip()}")
        if proc.stderr:
            print(f"[execute_git.py] Notice/Stderr:\n{proc.stderr.strip()}", file=sys.stderr)

        if proc.returncode != 0:
            err_details = proc.stderr.strip() or proc.stdout.strip() or f"Execution failed with code {proc.returncode}"
            print(f"[execute_git.py] Git execution FAILED: {err_details}", file=sys.stderr)
            try:
                with open(status_file, "w", encoding="utf-8") as f:
                    f.write(f"[GIT ERROR] {err_details}")
            except Exception:
                pass
            try:
                if os.path.exists(intent_file):
                    with open(intent_file, "r", encoding="utf-8") as inf:
                        idat = json.load(inf)
                    idat["speaking_error"] = f"Git operation failed, sir: {err_details[:80]}"
                    with open(intent_file, "w", encoding="utf-8") as inf:
                        json.dump(idat, inf, indent=2)
            except Exception:
                pass
            sys.exit(proc.returncode)

        # Execution succeeded
        try:
            with open(status_file, "w", encoding="utf-8") as f:
                f.write(f"[GIT SUCCESS] {data.get('speaking_response', 'Git action completed.')}")
        except Exception:
            pass
        sys.exit(0)
    except Exception as e:
        print(f"[execute_git.py] Execution error: {e}", file=sys.stderr)
        try:
            with open(status_file, "w", encoding="utf-8") as f:
                f.write(f"[GIT ERROR] {e}")
        except Exception:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()
