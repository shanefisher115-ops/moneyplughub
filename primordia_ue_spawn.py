import json
import os
import unreal

MANIFEST_PATH = r"C:\Users\Shane\moneyplughub\primordia_realm_manifest.json"

def hex_to_linear_color(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        return unreal.LinearColor(r, g, b, 1.0)
    return unreal.LinearColor(1.0, 1.0, 1.0, 1.0)

def load_manifest():
    if not os.path.exists(MANIFEST_PATH):
        unreal.log_error(f"❌ [Primordia Engine] Manifest missing at {MANIFEST_PATH}")
        return None
    with open(MANIFEST_PATH, 'r') as f:
        return json.load(f)

def build_advanced_realm():
    manifest = load_manifest()
    if not manifest:
        return

    realm_id = manifest.get("realm_id")
    sigil_name = manifest.get("sigil_name")
    intent = manifest.get("intent")
    env = manifest.get("environment", {})
    biome = env.get("biome_style", "Cyber Grid")
    lighting_hex = env.get("global_illumination_hex", "#00FFFF")
    density = env.get("asset_density", "Dense")
    ref_node = manifest.get("economic_node")

    unreal.log(f"🌌 [Primordia Realizer] Materializing Spatial Realm Assets for Sigil: {sigil_name}")

    color = hex_to_linear_color(lighting_hex)

    # 1. Spawn / Configure Atmospheric & Directional Lighting
    editor_subsystem = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    world = editor_subsystem.get_editor_world()

    # Create Primary Sigil Core Light
    light_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 1000))
    if light_actor:
        light_component = light_actor.get_component_by_class(unreal.LightComponent)
        if light_component:
            light_component.set_light_color(color)
            light_component.set_intensity(5.0)
            unreal.log(f"💡 Directional Light set to Sigil Hex Frequency: {lighting_hex}")

    # 2. Spawn Central Sigil Altar / Core Geometry (Cube Pillar)
    core_pillar = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    if core_pillar:
        core_pillar.set_actor_label(f"SigilCore_{sigil_name}")
        core_pillar.set_actor_scale3d(unreal.Vector(2.0, 2.0, 10.0))
        unreal.log(f"🏛️ Central Sigil Pillar Spawned at World Center (0, 0, 0)")

    # 3. Spawn Procedural Peripheral Node Grid (Density Based)
    grid_count = 12 if density == "Infinite" else (8 if density == "Dense" else 4)
    radius = 1200.0
    import math

    for i in range(grid_count):
        angle = (2 * math.pi / grid_count) * i
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        
        node_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, 0))
        if node_actor:
            node_actor.set_actor_label(f"Node_{sigil_name}_{i+1}")
            node_actor.set_actor_scale3d(unreal.Vector(1.0, 1.0, 4.0))

    # 4. Attach Economic 3D Text / Portal Marker
    text_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.TextRenderActor, unreal.Vector(0, 0, 600))
    if text_actor:
        text_actor.set_actor_label(f"MoneyPlugHub_Portal_{realm_id}")
        text_component = text_actor.get_component_by_class(unreal.TextRenderComponent)
        if text_component:
            text_component.set_text(f"SIGIL: {sigil_name}\nINTENT: {intent}\nMONEYPLUGHUB: {ref_node}")
            text_component.set_text_render_color(unreal.Color(int(color.r*255), int(color.g*255), int(color.b*255), 255))
            text_component.set_world_size(45.0)

    unreal.log(f"✨ Realm Generation Complete: {grid_count} Node Pillars, Core Altar, Hex Light, and Economic HUD Bound!\n")

if __name__ == "__main__":
    build_advanced_realm()