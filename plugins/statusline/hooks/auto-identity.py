#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["anthropic"]
# ///
"""Unified identity generator - generates name, description, and summary in ONE call.

This consolidates auto-name.py, auto-description.py, and auto-summary.py into a single
hook that makes ONE subprocess/API call instead of THREE. This is 3x faster and eliminates
resource contention that was causing system freezes.

Generation logic:
- NAME: Only on first prompt (when auto_named is false)
- DESCRIPTION: On first prompt, then stable unless context significantly changes
- SUMMARY: Every prompt (reflects current work)

Output format requested from Claude:
    NAME: <1-2 word symbolic name>
    DESCRIPTION: <Plugin Role format>
    SUMMARY: <5-10 word first-person summary>

The response is parsed and each value is saved to its respective location.
"""

import fcntl
import json
import os
import re
import sys
from pathlib import Path

# Add lib to path for shared infrastructure
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))

from claude_backend import (
    debug,
    get_config,
    get_api_key,
    get_instances_dir,
    get_agent_name,
    get_recent_messages,
    get_previous_summaries,
    get_previous_descriptions,
    format_messages_for_prompt,
    generate_with_backend,
    write_with_history,
    update_registry_task,
    load_prompt_template,
    parse_hook_input,
    log_statusline_event,
)

DEBUG_PREFIX = "identity"


def log(msg: str):
    """Debug helper using our prefix."""
    debug(msg, DEBUG_PREFIX)


def check_needs_name(instances_dir: Path, session_id: str) -> bool:
    """Check if session needs a name (hasn't been auto_named yet or still has default)."""
    registry = instances_dir / "registry.json"
    if not registry.exists():
        return False

    try:
        with open(registry) as f:
            data = json.load(f)
        session_data = data.get(session_id, {})
        # Check if auto_named is false
        if not session_data.get("auto_named", False):
            return True
        # Also regenerate if name is still default (generation may have failed)
        name = session_data.get("name", "")
        if name == "Claude" or name.startswith("Claude-"):
            log(f"Name is default '{name}', will regenerate")
            return True
        return False
    except:
        return False


def claim_naming_rights(instances_dir: Path, session_id: str) -> bool:
    """Atomically claim naming rights for this session.

    Returns True if we successfully claimed or if regeneration is needed.
    """
    registry = instances_dir / "registry.json"
    if not registry.exists():
        return False

    try:
        with open(registry, "r+") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                data = json.load(f)
                session_data = data.get(session_id, {})

                # Check if already named with a real name
                if session_data.get("auto_named", False):
                    name = session_data.get("name", "")
                    # Allow regeneration if name is still default
                    if name != "Claude" and not name.startswith("Claude-"):
                        log(f"Already auto_named with '{name}', skipping")
                        return False
                    log(f"Name is default '{name}', allowing regeneration")

                # Claim it (or reclaim for regeneration)
                session_data["auto_named"] = True
                data[session_id] = session_data

                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()

                log("Claimed naming rights")
                return True
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except Exception as e:
        log(f"Error claiming naming rights: {e}")
        return False


def save_name(instances_dir: Path, session_id: str, name: str) -> bool:
    """Save the generated name to registry."""
    registry = instances_dir / "registry.json"
    if not registry.exists():
        return False

    try:
        with open(registry, "r+") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                data = json.load(f)
                if session_id in data:
                    data[session_id]["name"] = name
                    f.seek(0)
                    json.dump(data, f, indent=2)
                    f.truncate()
                    log(f"Saved name: {name}")
                    return True
                return False
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except Exception as e:
        log(f"Error saving name: {e}")
        return False


def check_needs_description(instances_dir: Path, session_id: str) -> bool:
    """Check if session needs a description (doesn't have one yet or has placeholder)."""
    desc_file = instances_dir / "descriptions" / f"{session_id}.txt"
    if desc_file.exists():
        content = desc_file.read_text().strip()
        # Regenerate if file contains placeholder
        if content == "Awaiting instructions." or content == "":
            log(f"Description is placeholder, will regenerate")
            return True
        log(f"Description already exists: {content[:30]}...")
        return False
    return True


def save_description(instances_dir: Path, session_id: str, description: str):
    """Save description to file."""
    desc_dir = instances_dir / "descriptions"
    desc_dir.mkdir(parents=True, exist_ok=True)
    desc_file = desc_dir / f"{session_id}.txt"
    desc_file.write_text(description)
    log(f"Saved description: {description}")


def save_summary(instances_dir: Path, session_id: str, summary: str, cwd: str):
    """Save summary to file and registry."""
    write_with_history(instances_dir, session_id, "summaries", summary, DEBUG_PREFIX)
    update_registry_task(instances_dir, session_id, summary, DEBUG_PREFIX)


def build_combined_prompt(
    script_dir: Path,
    needs_name: bool,
    needs_description: bool,
    user_prompt: str,
    agent_name: str,
    context: str,
    prev_summaries: str,
    prev_descriptions: str,
    first_prompts: str,
    recent_prompts: str,
) -> str:
    """Build a combined prompt by loading from versioned prompt files.

    Loads prompts from prompts/{name,description,summary}/*.md based on config.yaml.
    Template variables are filled in before composing into the final prompt.
    Only includes name/description sections if they need to be generated.
    """
    sections = []

    sections.append(f"""You are {agent_name}, a Claude Code assistant.

Generate identity information based on the USER'S ACTUAL MESSAGE, not assumptions about the directory or environment.

CRITICAL RULES:
- Do NOT infer from directory path or environment
- For greetings (Hello/Hi/Hey): name="Spark", description="General Assistant", summary="Awaiting task direction"
- For tests (Testing/Test): name="Echo", description="General Assistant", summary="Testing the system"
- For specific tasks: derive from the ACTUAL USER WORDS only""")

    # Load and add NAME section if needed
    if needs_name:
        name_default = "Generate a 1-2 word symbolic name for this session."
        name_prompt = load_prompt_template(script_dir, "name-prompt.txt", name_default)
        # Fill in template variables
        name_prompt = name_prompt.format(user_prompt=user_prompt[:500] if user_prompt else "(none)")
        sections.append(f"\n=== NAME ===\n{name_prompt}")

    # Load and add DESCRIPTION section if needed
    if needs_description:
        desc_default = "Generate a 2-word description in format [Plugin] [Role]."
        desc_prompt = load_prompt_template(script_dir, "description-prompt.txt", desc_default)
        # Fill in template variables
        desc_prompt = desc_prompt.format(
            agent_name=agent_name,
            first_prompts=first_prompts,
            recent_prompts=recent_prompts,
            prev_descriptions=prev_descriptions,
            prev_summaries=prev_summaries,
        )
        sections.append(f"\n=== DESCRIPTION ===\n{desc_prompt}")

    # Load and add SUMMARY section
    summary_default = "Write a 5-10 word first-person summary of current work."
    summary_prompt = load_prompt_template(script_dir, "summary-prompt.txt", summary_default)
    # Fill in template variables
    summary_prompt = summary_prompt.format(
        agent_name=agent_name,
        prev_summaries=prev_summaries,
        context=context,
    )
    sections.append(f"\n=== SUMMARY ===\n{summary_prompt}")

    # Output format - JSON on single line for headless compatibility
    # CRITICAL: headless backend only captures first line, so NO code blocks
    # Build JSON template based on what we need
    json_fields = []
    if needs_name:
        json_fields.append('"name":"NAME"')
    if needs_description:
        json_fields.append('"description":"DESCRIPTION"')
    json_fields.append('"summary":"SUMMARY"')  # Always need summary
    json_template = "{" + ",".join(json_fields) + "}"

    sections.append(f"""
=== OUTPUT ===
CRITICAL: Output ONLY this JSON on ONE line, NO code blocks, NO explanation:
{json_template}""")

    return "\n".join(sections)


def parse_response(response: str, needs_name: bool) -> dict:
    """Parse the JSON response into components."""
    result = {"name": None, "description": None, "summary": None}

    # Try to parse as JSON
    try:
        # Clean up response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            # Extract content between code blocks
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        # Find JSON object in response
        json_match = re.search(r'\{[^{}]+\}', cleaned)
        if json_match:
            data = json.loads(json_match.group())
            result["name"] = data.get("name")
            result["description"] = data.get("description")
            result["summary"] = data.get("summary")

            # Clean up name to max 2 words
            if result["name"]:
                words = result["name"].split()[:2]
                result["name"] = " ".join(words)

            return result
    except json.JSONDecodeError:
        pass

    # Fallback: try line-based parsing
    name_match = re.search(r'NAME:\s*(.+?)(?:\n|$)', response, re.IGNORECASE)
    desc_match = re.search(r'DESCRIPTION:\s*(.+?)(?:\n|$)', response, re.IGNORECASE)
    summary_match = re.search(r'SUMMARY:\s*(.+?)(?:\n|$)', response, re.IGNORECASE)

    if needs_name and name_match:
        name = name_match.group(1).strip().strip('"\'')
        words = name.split()[:2]
        result["name"] = " ".join(words)

    if desc_match:
        result["description"] = desc_match.group(1).strip().strip('"\'')

    if summary_match:
        result["summary"] = summary_match.group(1).strip().strip('"\'')

    return result


def main():
    log("Starting unified identity hook")

    # Parse input
    data = parse_hook_input(DEBUG_PREFIX)
    if not data:
        return

    session_id = data.get("session_id", "")
    cwd = data.get("cwd", ".")
    user_prompt = data.get("prompt", "")
    transcript_path = data.get("transcript_path", "")

    log(f"Session: {session_id[:8] if session_id else 'none'}")

    if not session_id:
        log("No session_id, exiting")
        return

    # Get configuration
    config = get_config(cwd, DEBUG_PREFIX)
    api_key = get_api_key(cwd, DEBUG_PREFIX)
    instances_dir = get_instances_dir(cwd)

    if not instances_dir:
        log("No instances directory found")
        return

    # Determine what we need to generate
    needs_name = check_needs_name(instances_dir, session_id)
    needs_description = check_needs_description(instances_dir, session_id)

    # If we need a name, try to claim naming rights
    if needs_name:
        needs_name = claim_naming_rights(instances_dir, session_id)

    log(f"Needs name: {needs_name}, needs description: {needs_description}")

    # Gather context
    agent_name = get_agent_name(instances_dir, session_id)
    messages = get_recent_messages(cwd, session_id, limit=10, prefix=DEBUG_PREFIX)
    context = format_messages_for_prompt(messages, DEBUG_PREFIX)
    prev_summaries = get_previous_summaries(instances_dir, session_id, limit=3)
    prev_descriptions = get_previous_descriptions(instances_dir, session_id, limit=3)

    # Get first/recent prompts for description stability
    first_prompts = "\n".join([m.get("content", "")[:200] for m in messages[:2]]) if messages else ""
    recent_prompts = "\n".join([m.get("content", "")[:200] for m in messages[-3:]]) if messages else ""

    # Build combined prompt (load from versioned prompt files)
    script_dir = Path(__file__).parent
    prompt = build_combined_prompt(
        script_dir=script_dir,
        needs_name=needs_name,
        needs_description=needs_description,
        user_prompt=user_prompt,
        agent_name=agent_name,
        context=context,
        prev_summaries=prev_summaries,
        prev_descriptions=prev_descriptions,
        first_prompts=first_prompts,
        recent_prompts=recent_prompts,
    )

    # Generate with single call (multiline=True to get full JSON response)
    log("Generating identity (single call)...")
    response = generate_with_backend(
        prompt=prompt,
        config=config,
        api_key=api_key,
        max_tokens=100,  # Enough for all three
        temperature=0.5,
        prefix=DEBUG_PREFIX,
        multiline=True,  # Need full response for JSON parsing
    )

    if not response:
        log("Generation failed")
        log_statusline_event("identity", session_id, "", False, DEBUG_PREFIX, instances_dir)
        return

    log(f"Response: {response}")

    # Parse response
    result = parse_response(response, needs_name)
    log(f"Parsed: {result}")

    # Save each component
    success = True

    if needs_name and result["name"]:
        if save_name(instances_dir, session_id, result["name"]):
            log_statusline_event("name", session_id, result["name"], True, DEBUG_PREFIX, instances_dir)
        else:
            success = False
            log_statusline_event("name", session_id, "", False, DEBUG_PREFIX, instances_dir)

    if needs_description:
        if result["description"]:
            save_description(instances_dir, session_id, result["description"])
            log_statusline_event("description", session_id, result["description"], True, DEBUG_PREFIX, instances_dir)
        else:
            log_statusline_event("description", session_id, "", False, DEBUG_PREFIX, instances_dir)
            success = False
    # else: description already exists, nothing to do

    if result["summary"]:
        save_summary(instances_dir, session_id, result["summary"], cwd)
        log_statusline_event("summary", session_id, result["summary"], True, DEBUG_PREFIX, instances_dir)
    else:
        log_statusline_event("summary", session_id, "", False, DEBUG_PREFIX, instances_dir)
        success = False

    log(f"Identity generation complete, success={success}")


if __name__ == "__main__":
    main()
