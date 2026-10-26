"""
head_to_head.py: Shared Arena Competitive Exclusion Experiment

Direct head-to-head competition between two policy arms in the EXACT SAME realm:
  Arm A: Trained (frozen PPO checkpoint, e.g. trained_bench.pt)
  Arm B: Random (or Greedy) baseline

Both arms share the exact same root species ("LumenSeed"), so they have identical
physics, max health, energy drain, movement cost, and sensor suites.
Under resource scarcity (e.g. 5 food nodes), food supply is strictly zero-sum:
every bite eaten by Arm A directly deprives Arm B, creating real Darwinian selection
pressure and producing true competitive exclusion curves.
"""

import argparse
import json
import math
import os
import random
import shlex
import statistics
import subprocess
import sys
import time
import torch
import torch.nn as nn

RL_BRIDGE_DIR = r"C:\Users\Shane\Documents\dev\primordiaos-core-workspace\primordia-spellwright\realm-bridge\rl-bridge"
if RL_BRIDGE_DIR not in sys.path:
    sys.path.insert(0, RL_BRIDGE_DIR)

import agent_trainer
from agent_trainer import ActorCritic, RunningMeanStd, RealmClient, observe, food_vector, OBS_SIZE, MOVE_SIZE


def run_head_to_head(seed, args, checkpoint_data):
    port = args.port
    trained_species = "LumenSeed/trained"
    opponent_species = f"LumenSeed/{args.opponent}"
    
    # 1. Start headless realm with both species in the same world
    realm_cmd = [
        sys.executable, "-u", os.path.join(RL_BRIDGE_DIR, "headless_realm.py"),
        "--port", str(port),
        "--realm", f"h2h-{args.opponent}-{seed}",
        "--seed", str(seed),
        "--speed", str(args.speed),
        "--agents", str(args.agents_per_arm),
        "--pool", str(args.agents_per_arm),
        "--resources", str(args.resources),
        "--respawn-below", "0",  # Zero immigration: starvation causes real population drops!
        "--species", trained_species, opponent_species,
        "--bridge", json.dumps({"maturity_s": 1e9 if not args.allow_reproduction else 0.0, "resource_regen_per_s": 4})
    ]
    
    realm_log_path = os.path.join(args.out, f"realm_seed_{seed}.log")
    realm_log = open(realm_log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(realm_cmd, stdout=realm_log, stderr=subprocess.STDOUT)
    time.sleep(2)
    
    client = RealmClient(f"127.0.0.1:{port}", timeout=15.0)
    client.connect(retries=20)
    
    # 2. Setup trained policy network and obs normalizer
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
    
    # Metrics tracking over time
    history = []
    starvations = {"trained": 0, args.opponent: 0}
    food_eaten = {"trained": 0.0, args.opponent: 0.0}
    alignments = {"trained": [], args.opponent: []}
    
    t0 = time.time()
    last_log_t = 0.0
    extinction_time = None
    winner = None
    
    print(f"\n[Seed {seed}] Arena Started: 5 Food Nodes | 16 Trained vs 16 {args.opponent.capitalize()}", flush=True)
    print(f"{'SimTime':>8} | {'Pop Trained':>12} | {f'Pop {args.opponent.capitalize()}':>12} | {'Food Trained':>12} | {f'Food {args.opponent.capitalize()}':>12} | {'Starvations':>15}", flush=True)
    print("-" * 85, flush=True)
    
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
            
            # Record events
            for ev in events:
                if ev.get("type") == "death":
                    species = ev.get("species", "")
                    cause = ev.get("cause", "unknown")
                    if "trained" in species:
                        starvations["trained"] += 1
                    else:
                        starvations[args.opponent] += 1
                        
            # Partition live actors by arm
            trained_actors = [a for a in actors if a.get("species") == trained_species]
            opponent_actors = [a for a in actors if a.get("species") == opponent_species]
            
            pop_t = len(trained_actors)
            pop_o = len(opponent_actors)
            
            # Check extinction
            if (pop_t == 0 or pop_o == 0) and extinction_time is None and sim_time > 10.0:
                extinction_time = sim_time
                winner = "trained" if pop_t > 0 else args.opponent
                print(f"\n>>> EXTINCTION at Sim Time {sim_time:.1f}s! Winner: {winner.upper()} (Trained: {pop_t}, {args.opponent}: {pop_o}) <<<\n", flush=True)
                break
                
            # Log snapshot every 10 simulated seconds
            if sim_time - last_log_t >= 10.0:
                last_log_t = sim_time
                f_t = sum(a.get("food", 0.0) for a in trained_actors)
                f_o = sum(a.get("food", 0.0) for a in opponent_actors)
                history.append({
                    "sim_time": round(sim_time, 1),
                    "pop_trained": pop_t,
                    f"pop_{args.opponent}": pop_o,
                    "food_trained": round(f_t, 2),
                    f"food_{args.opponent}": round(f_o, 2),
                    "starved_trained": starvations["trained"],
                    f"starved_{args.opponent}": starvations[args.opponent]
                })
                print(f"{sim_time:8.1f} | {pop_t:12d} | {pop_o:12d} | {f_t:12.1f} | {f_o:12.1f} | {starvations['trained']:6d} vs {starvations[args.opponent]:<6d}", flush=True)
                
            # Compute actions
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
                        
            # 2. Opponent policy
            if opponent_actors:
                if args.opponent == "random":
                    for act in opponent_actors:
                        rx = random.uniform(-1.0, 1.0)
                        ry = random.uniform(-1.0, 1.0)
                        actions.append({"id": act["id"], "delta_position": [rx * max_step_cm, ry * max_step_cm, 0.0]})
                        fv, _ = food_vector(act)
                        if fv and (fv[0] or fv[1]):
                            align = (rx*fv[0] + ry*fv[1]) / (math.hypot(rx, ry) * math.hypot(fv[0], fv[1]))
                            alignments[args.opponent].append(align)
                elif args.opponent == "greedy":
                    for act in opponent_actors:
                        fv, _ = food_vector(act)
                        norm = math.hypot(fv[0], fv[1]) if fv else 0.0
                        if norm > 1e-6:
                            gx, gy = fv[0] / norm, fv[1] / norm
                        else:
                            gx, gy = random.uniform(-1.0, 1.0), random.uniform(-1.0, 1.0)
                        actions.append({"id": act["id"], "delta_position": [gx * max_step_cm, gy * max_step_cm, 0.0]})
                        if fv and norm > 1e-6:
                            alignments[args.opponent].append(1.0)
                            
            seq += 1
            client.send({"type": "actions", "seq": seq, "actions": actions})
            
            if sim_time >= args.max_sim_seconds:
                print(f"\nReached max time limit ({args.max_sim_seconds}s).", flush=True)
                break
                
    finally:
        client.close()
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        realm_log.close()
        
    final_pop_t = history[-1]["pop_trained"] if history else 0
    final_pop_o = history[-1][f"pop_{args.opponent}"] if history else 0
    
    return {
        "seed": seed,
        "winner": winner or ("trained" if final_pop_t > final_pop_o else args.opponent if final_pop_o > final_pop_t else "tie"),
        "extinction_time_s": extinction_time,
        "final_pop_trained": final_pop_t,
        f"final_pop_{args.opponent}": final_pop_o,
        "starvations": starvations,
        "mean_alignment": {
            "trained": statistics.fmean(alignments["trained"]) if alignments["trained"] else 0.0,
            args.opponent: statistics.fmean(alignments[args.opponent]) if alignments[args.opponent] else 0.0
        },
        "history": history
    }


def main():
    p = argparse.ArgumentParser(description="Shared Arena Head-to-Head Competitive Exclusion Sweep")
    p.add_argument("--checkpoint", default=r"c:\Users\Shane\moneyplughub\research\scarcity\baseline\trained_bench.pt")
    p.add_argument("--seeds", type=int, nargs="+", default=[11, 12, 13])
    p.add_argument("--resources", type=int, default=5, help="Food node density (5 = extreme scarcity)")
    p.add_argument("--agents-per-arm", type=int, default=16)
    p.add_argument("--speed", type=float, default=4.0)
    p.add_argument("--max-sim-seconds", type=float, default=400.0)
    p.add_argument("--port", type=int, default=9850)
    p.add_argument("--opponent", choices=("random", "greedy"), default="random")
    p.add_argument("--allow-reproduction", action="store_true")
    p.add_argument("--out", default=r"c:\Users\Shane\moneyplughub\research\scarcity\competition")
    args = p.parse_args()
    
    os.makedirs(args.out, exist_ok=True)
    
    print(f"Loading checkpoint from: {args.checkpoint}")
    ckpt = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    
    results = {}
    for seed in args.seeds:
        res = run_head_to_head(seed, args, ckpt)
        results[str(seed)] = res
        
    out_file = os.path.join(args.out, f"competition_res_{args.resources}_vs_{args.opponent}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"args": vars(args), "results": results}, f, indent=2)
        
    print(f"\n==================================================================")
    print(f"HEAD-TO-HEAD COMPETITION COMPLETE ({args.resources} Food Nodes: Trained vs {args.opponent.capitalize()})")
    print(f"Saved to: {out_file}")
    print(f"==================================================================")


if __name__ == "__main__":
    main()
