#!/usr/bin/env python3
"""
DaVinci Resolve Studio Python Automation Bridge
Integrates MoneyPlugHub / Gemini Omni Flash / Runway AI generated assets directly into DaVinci Resolve.
"""

import sys
import os
import json
import argparse

def get_resolve_instance():
    """Locates and connects to the running DaVinci Resolve instance."""
    try:
        import DaVinciResolveScript as dvr
        return dvr.scriptapp("Resolve")
    except ImportError:
        # Platform-specific default paths for DaVinci Resolve scripting
        if sys.platform.startswith("win"):
            script_path = os.path.join(
                os.environ.get("PROGRAMDATA", "C:\\ProgramData"),
                "Blackmagic Design", "DaVinci Resolve", "Support", "Developer", "Scripting", "Modules"
            )
        elif sys.platform.startswith("darwin"):
            script_path = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"
        else:
            script_path = "/opt/resolve/Developer/Scripting/Modules"
        
        if os.path.exists(script_path):
            sys.path.append(script_path)
            try:
                import DaVinciResolveScript as dvr
                return dvr.scriptapp("Resolve")
            except Exception as e:
                print(f"[DaVinci Bridge] Error importing DaVinciResolveScript: {e}")
                return None
    return None

def build_timeline_from_manifest(manifest_path, project_name="MoneyPlugHub_Project"):
    """Reads a JSON media manifest and constructs a DaVinci Resolve project & timeline."""
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    resolve = get_resolve_instance()
    if not resolve:
        print("[DaVinci Bridge] ⚠️ DaVinci Resolve is not currently open or scripting is disabled.")
        print(f"[DaVinci Bridge] ℹ️ Generated standalone FCPXML fallback available for direct import.")
        return False

    project_manager = resolve.GetProjectManager()
    project = project_manager.CreateProject(project_name) or project_manager.LoadProject(project_name)
    if not project:
        print(f"[DaVinci Bridge] ❌ Could not create/load project: {project_name}")
        return False

    media_pool = project.GetMediaPool()
    root_folder = media_pool.GetRootFolder()

    clips_to_import = [c["filePath"] for c in data.get("clips", []) if os.path.exists(c.get("filePath", ""))]
    if not clips_to_import:
        print("[DaVinci Bridge] ⚠️ No local clip filepaths found to import.")
        return False

    imported_items = media_pool.ImportMedia(clips_to_import)
    timeline_name = data.get("timelineName", "MoneyOS_Master_Sequence")
    timeline = media_pool.CreateEmptyTimeline(timeline_name)

    if timeline:
        media_pool.AppendToTimeline(imported_items)
        print(f"[DaVinci Bridge] ✅ Timeline '{timeline_name}' successfully created in DaVinci Resolve!")
        return True

    return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DaVinci Resolve Bridge for MoneyPlugHub")
    parser.add_argument("--manifest", type=str, help="Path to clip manifest JSON file")
    parser.add_argument("--project", type=str, default="MoneyPlugHub_Sequence", help="Project name")
    args = parser.parse_args()

    if args.manifest and os.path.exists(args.manifest):
        build_timeline_from_manifest(args.manifest, args.project)
    else:
        print("[DaVinci Bridge] Initialized. Pass --manifest <path.json> to assemble DaVinci timelines.")
