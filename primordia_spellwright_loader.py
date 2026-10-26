import json
import os
import math
import unreal

REGISTRY_PATH = r"C:\Users\Shane\moneyplughub\primordia_spellwright_registry.json"

def hex_to_linear_color(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        return unreal.LinearColor(r, g, b, 1.0)
    return unreal.LinearColor(1.0, 1.0, 1.0, 1.0)

def load_spellwright_registry():
    if not os.path.exists(REGISTRY_PATH):
        unreal.log_error(f"❌ [Primordia-Spellwright] Registry missing at {REGISTRY_PATH}")
        return []
    with open(REGISTRY_PATH, 'r') as f:
        return json.load(f)

def instantiate_spellwright_matrix():
    sigils = load_spellwright_registry()
    if not sigils:
        return

    unreal.log(f"\n🌌 [Primordia-Spellwright UE Engine] Materializing {len(sigils)} Realm Nodes...")

    radius = 3500.0  # Radial layout distance for world nodes
    total_sigils = len(sigils)

    for idx, s in enumerate(sigils):
        sigil_name = s.get("sigil")
        biome = s.get("biome")
        hex_color = s.get("lighting")
        density = s.get("density")
        ref_link = s.get("referralUrl")

        # Calculate orbital coordinates in 3D space
        angle = (2 * math.pi / total_sigils) * idx
        x_pos = radius * math.cos(angle)
        y_pos = radius * math.sin(angle)
        z_pos = 0.0

        color = hex_to_linear_color(hex_color)

        # 1. Spawn Realm Pillar Altar
        pillar = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.StaticMeshActor, 
            unreal.Vector(x_pos, y_pos, z_pos)
        )
        if pillar:
            pillar.set_actor_label(f"Spellwright_{sigil_name}")
            pillar.set_actor_scale3d(unreal.Vector(3.0, 3.0, 12.0))

        # 2. Spawn Node Point Light tuned to Sigil Frequency
        light_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.PointLight, 
            unreal.Vector(x_pos, y_pos, z_pos + 800)
        )
        if light_actor:
            light_component = light_actor.get_component_by_class(unreal.PointLightComponent)
            if light_component:
                light_component.set_light_color(color)
                light_component.set_intensity(15000.0)
                light_component.set_attenuation_radius(2500.0)

        # 3. Spawn Economic & Spatial HUD Text
        text_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.TextRenderActor, 
            unreal.Vector(x_pos, y_pos, z_pos + 1400)
        )
        if text_actor:
            text_actor.set_actor_label(f"HUD_{sigil_name}")
            text_comp = text_actor.get_component_by_class(unreal.TextRenderComponent)
            if text_comp:
                text_comp.set_text(f"SIGIL: {sigil_name}\nBIOME: {biome}\nDENSITY: {density}\nMONEYPLUGHUB: {ref_link}")
                text_comp.set_text_render_color(unreal.Color(int(color.r*255), int(color.g*255), int(color.b*255), 255))
                text_comp.set_world_size(60.0)

        unreal.log(f"✨ Instantiated Realm Node: {sigil_name} [{biome}] at Position ({int(x_pos)}, {int(y_pos)})")

    unreal.log("\n🐉 [Primordia-Spellwright Matrix Complete] World open-world network established.\n")

if __name__ == "__main__":
    instantiate_spellwright_matrix()