"""
predator_pressure.py: Predator Pressure and Selection Dynamics Across Food Densities

Experiment Design:
  Evaluates 16 Trained LumenSeed vs 16 Random LumenSeed in a shared arena containing
  4 Gravemind predators, across two contrasting food regimes:
    1. Food Abundance: 40 Food Nodes
    2. Food Scarcity:   5 Food Nodes

Measures:
  - Cause-specific mortality: Predation (killed by Gravemind) vs Starvation (depleted energy)
  - Time-to-extinction and survival curves
  - Food captured by Trained vs Random under predator threat
  - Velocity alignment and exposure time in open transit
"""

import argparse
import json
import math
import os
import random
import statistics
import subprocess
import sys
import time
import torch

RL_BRIDGE_DIR = r"C:\Users\Shane\Documents\dev\primordiaos-core-workspace\primordia-spellwright\realm-bridge\rl-bridge"
if RL_BRIDGE_DIR not in sys.path:
    sys.path.insert(0, RL_BRIDGE_DIR)

import agent_trainer
from agent_trainer import ActorCritic, RunningMeanStd, RealmClient, observe, food_vector, OBS_SIZE, MOVE_SIZE


def run_predator_trial(seed, density, args, checkpoint_data):
    port = args.port
    trained_species = "LumenSeed/trained"
    random_species = "LumenSeed/random"
    predator_species = "Gravemind"
    
    species_list = [trained_species, random_species, predator_species]
    species_counts = {
        trained_species: args.foragers_per_arm,
        random_species: args.foragers_per_arm,
        predator_species: args.predators
    }
    
    # 1. Start headless realm
    realm_cmd = [
        sys.executable, "-u", os.path.join(RL_BRIDGE_DIR, "headless_realm.py"),
        "--port", str(port),
        "--realm", f"predator-d{density}-s{seed}",
        "--seed", str(seed),
        "--speed", str(args.speed),
        "--agents", str(args.foragers_per_arm),
        "--pool", "32",
        "--resources", str(density),
        "--respawn-below", "0",  # Zero immigration for foragers: deaths are permanent!
        "--species", *species_list,
        "--species-counts", json.dumps(species_counts),
        "--bridge", json.dumps({"maturity_s": 1e9, "resource_regen_per_s": 4})
    ]
    
    os.makedirs(args.out, exist_ok=True)
    realm_log_path = os.path.join(args.out, f"realm_d{density}_s{seed}.log")
    realm_log = open(realm_log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(realm_cmd, stdout=realm_log, stderr=subprocess.STDOUT)
    time.sleep(2)
    
    client = RealmClient(f"127.0.0.1:{port}", timeout=15.0)
    client.connect(retries=20)
    
    # 2. Setup trained policy network
    device = torch.device("cpu")
    net = ActorCritic(obs_size=OBS_SIZE, hidden=128).to(device)
    net.load_state_dict(checkpoint_data["brains"][0]["net"])
    net.eval()
    
    obs_rms = RunningMeanStd(OBS_SIZE, device)
    if "obs_rms" in checkpoint_data:
        obs_rms.load(checkpoint_data["obs_rms"])
        
    hello = client.recv()
    limits = hello.get("limits", {})
    max_step_cm = limits.get("max_step_cm", 300.0)
    
    deaths = {
        "trained": {"predation": 0, "starvation": 0, "other": 0},
        "random": {"predation": 0, "starvation": 0, "other": 0},
        "predator": {"starvation": 0, "other": 0}
    }
    food_eaten = {"trained": 0.0, "random": 0.0, "predator": 0.0}
    alignments = {"trained": [], "random": []}
    history = []
    
    print(f"\n[Density {density} | Seed {seed}] Arena Started: {args.foragers_per_arm} Trained, {args.foragers_per_arm} Random, {args.predators} Predators", flush=True)
    print(f"{'SimTime':>8} | {'Pop Train':>10} | {'Pop Rand':>10} | {'Predators':>10} | {'Train Pred/Starv':>18} | {'Rand Pred/Starv':>18}", flush=True)
    print("-" * 88, flush=True)
    
    t0 = time.time()
    last_log_t = 0.0
    extinction_events = {}
    
    try:
        seq = 0
        while True:
            msg = client.recv()
            if not msg:
                break
            if msg.get("type") != "state":
                continue
                
            sim_time = msg["time"]
            actors = msg.get("actors", [])
            events = msg.get("events", [])
            
            # Process events
            for ev in events:
                if ev.get("type") == "death":
                    species = ev.get("species", "")
                    cause = str(ev.get("cause", "")).lower()
                    
                    category = "predation" if ("killed by" in cause or "wound" in cause) else \
                               "starvation" if ("starv" in cause) else "other"
                    
                    if "trained" in species:
                        deaths["trained"][category] += 1
                    elif "random" in species:
                        deaths["random"][category] += 1
                    elif "Gravemind" in species:
                        cat = "starvation" if "starv" in cause else "other"
                        deaths["predator"][cat] += 1
                        
            trained_actors = [a for a in actors if a.get("species") == trained_species]
            random_actors = [a for a in actors if a.get("species") == random_species]
            predator_actors = [a for a in actors if "Gravemind" in a.get("species", "")]
            
            pop_t = len(trained_actors)
            pop_r = len(random_actors)
            pop_p = len(predator_actors)
            
            if pop_r == 0 and "random" not in extinction_events and sim_time > 5.0:
                extinction_events["random"] = sim_time
                print(f"\n>>> RANDOM EXTINCT at Sim Time {sim_time:.1f}s! <<<", flush=True)
            if pop_t == 0 and "trained" not in extinction_events and sim_time > 5.0:
                extinction_events["trained"] = sim_time
                print(f"\n>>> TRAINED EXTINCT at Sim Time {sim_time:.1f}s! <<<", flush=True)
                
            if (pop_t == 0 and pop_r == 0) or sim_time >= args.max_sim_seconds:
                break
                
            # Log snapshot every 10 sim seconds
            if sim_time - last_log_t >= 10.0:
                last_log_t = sim_time
                f_t = sum(a.get("food", 0.0) for a in trained_actors)
                f_r = sum(a.get("food", 0.0) for a in random_actors)
                dt_pred = f"{deaths['trained']['predation']}/{deaths['trained']['starvation']}"
                dr_pred = f"{deaths['random']['predation']}/{deaths['random']['starvation']}"
                history.append({
                    "sim_time": round(sim_time, 1),
                    "pop_trained": pop_t,
                    "pop_random": pop_r,
                    "pop_predators": pop_p,
                    "deaths_trained": dict(deaths["trained"]),
                    "deaths_random": dict(deaths["random"]),
                    "food_trained": round(f_t, 1),
                    "food_random": round(f_r, 1)
                })
                print(f"{sim_time:8.1f} | {pop_t:10d} | {pop_r:10d} | {pop_p:10d} | {dt_pred:>18} | {dr_pred:>18}", flush=True)
                
            # Actions
            actions = []
            
            # 1. Trained policy: PPO forward pass
            if trained_actors:
                raw_obs = torch.tensor([observe(x) for x in trained_actors], dtype=torch.float32, device=device)
                norm_obs = obs_rms.normalize(raw_obs)
                with torch.no_grad():
                    move, breed, _ = net(norm_obs)
                    m = torch.tanh(move.mean).cpu().tolist()
                for i, act in enumerate(trained_actors):
                    dx = m[i][0] * max_step_cm
                    dy = m[i][1] * max_step_cm
                    actions.append({"id": act["id"], "delta_position": [dx, dy, 0.0]})
                    fv, _ = food_vector(act)
                    if fv and (fv[0] or fv[1]) and (m[i][0] or m[i][1]):
                        align = (m[i][0]*fv[0] + m[i][1]*fv[1]) / (math.hypot(m[i][0], m[i][1]) * math.hypot(fv[0], fv[1]))
                        alignments["trained"].append(align)
                        
            # 2. Random policy: Uniform random
            if random_actors:
                for act in random_actors:
                    rx = random.uniform(-1.0, 1.0)
                    ry = random.uniform(-1.0, 1.0)
                    actions.append({"id": act["id"], "delta_position": [rx * max_step_cm, ry * max_step_cm, 0.0]})
                    fv, _ = food_vector(act)
                    if fv and (fv[0] or fv[1]):
                        align = (rx*fv[0] + ry*fv[1]) / (math.hypot(rx, ry) * math.hypot(fv[0], fv[1]))
                        alignments["random"].append(align)
                        
            # 3. Predator policy: Greedy Hunt
            if predator_actors:
                for act in predator_actors:
                    sensors = act.get("sensors") or {}
                    enemy_v = sensors.get("enemy")  # Nearest prey!
                    if enemy_v:
                        dist = math.hypot(enemy_v[0], enemy_v[1])
                        if dist > 1e-6:
                            # Charge directly at nearest prey
                            px, py = enemy_v[0] / dist, enemy_v[1] / dist
                        else:
                            px, py = random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0)
                    else:
                        px, py = random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0)
                    actions.append({"id": act["id"], "delta_position": [px * max_step_cm, py * max_step_cm, 0.0]})
                    
            seq += 1
            client.send({"type": "actions", "seq": seq, "actions": actions})
            
    finally:
        client.close()
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        realm_log.close()
        
    return {
        "density": density,
        "seed": seed,
        "extinction_events": extinction_events,
        "deaths": deaths,
        "mean_alignment": {
            "trained": statistics.fmean(alignments["trained"]) if alignments["trained"] else 0.0,
            "random": statistics.fmean(alignments["random"]) if alignments["random"] else 0.0
        },
        "history": history
    }


def main():
    p = argparse.ArgumentParser(description="Predator Pressure Sweep across Food Densities")
    p.add_argument("--checkpoint", default=r"c:\Users\Shane\moneyplughub\research\scarcity\baseline\trained_bench.pt")
    p.add_argument("--seeds", type=int, nargs="+", default=[11, 12, 13])
    p.add_argument("--densities", type=int, nargs="+", default=[40, 5], help="Food node densities to evaluate")
    p.add_argument("--foragers-per-arm", type=int, default=16)
    p.add_argument("--predators", type=int, default=4)
    p.add_argument("--speed", type=float, default=2.0)
    p.add_argument("--max-sim-seconds", type=float, default=100.0)
    p.add_argument("--port", type=int, default=9860)
    p.add_argument("--out", default=r"c:\Users\Shane\moneyplughub\research\scarcity\predators")
    args = p.parse_args()
    
    os.makedirs(args.out, exist_ok=True)
    print(f"Loading checkpoint: {args.checkpoint}")
    ckpt = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    
    all_results = {}
    for d in args.densities:
        all_results[str(d)] = {}
        for s in args.seeds:
            res = run_predator_trial(s, d, args, ckpt)
            all_results[str(d)][str(s)] = res
            
    out_file = os.path.join(args.out, "predator_sweep_results.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"args": vars(args), "results": all_results}, f, indent=2)
        
    print(f"\n==================================================================")
    print(f"PREDATOR PRESSURE SWEEP COMPLETE! Saved to: {out_file}")
    print(f"==================================================================")


if __name__ == "__main__":
    main()
