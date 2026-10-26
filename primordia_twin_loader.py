import json
import os
import math
import unreal

TWIN_STATE_PATH = r"C:\Users\Shane\moneyplughub\primordia_digital_twin_state.json"

def hex_to_linear_color(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        return unreal.LinearColor(r, g, b, 1.0)
    return unreal.LinearColor(1.0, 1.0, 1.0, 1.0)

def load_digital_twin():
    if not os.path.exists(TWIN_STATE_PATH):
        unreal.log_error(f"❌ [Digital Twin] State file missing at {TWIN_STATE_PATH}")
        return None
    with open(TWIN_STATE_PATH, 'r') as f:
        return json.load(f)

def materialize_digital_twin():
    state = load_digital_twin()
    if not state:
        return

    nodes = state.get("nodes", [])
    metrics = state.get("metrics", {})
    apex = state.get("apex_index")

    unreal.log(f"\n🌐 [Primordia Digital Twin] Initializing Core Simulation... Apex Index: {apex}")
    unreal.log(f"📊 Active Nodes: {len(nodes)} | Workspace: {metrics.get('motherboard_workspace')}")

    radius = 4000.0
    total_nodes = len(nodes)

    # Spawn Central Core Telemetry Hub
    hub_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor, 
        unreal.Vector(0, 0, 0)
    )
    if hub_actor:
        hub_actor.set_actor_label("DigitalTwin_ApexHub")
        hub_actor.set_actor_scale3d(unreal.Vector(5.0, 5.0, 15.0))

    for idx, node in enumerate(nodes):
        angle = (2 * math.pi / total_nodes) * idx
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        z = 0.0

        color = hex_to_linear_color(node.get("lighting", "#00FFFF"))

        # Spawn Node Pillar
        pillar = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.StaticMeshActor, 
            unreal.Vector(x, y, z)
        )
        if pillar:
            pillar.set_actor_label(f"TwinNode_{node['name']}")
            pillar.set_actor_scale3d(unreal.Vector(2.0, 2.0, 8.0))

        # Spawn Telemetry HUD Text
        text_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.TextRenderActor, 
            unreal.Vector(x, y, z + 1000)
        )
        if text_actor:
            text_actor.set_actor_label(f"HUD_{node['name']}")
            comp = text_actor.get_component_by_class(unreal.TextRenderComponent)
            if comp:
                comp.set_text(f"NODE: {node['name']}\nBIOME: {node['biome']}\nREF: {node['referral']}\nSTATUS: {node['status']}")
                comp.set_text_render_color(unreal.Color(int(color.r*255), int(color.g*255), int(color.b*255), 255))
                comp.set_world_size(50.0)

    unreal.log("✨ [Digital Twin] Real-time spatial telemetry matrix fully materialized.\n")

if __name__ == "__main__":
    materialize_digital_twin()