# Build PrimordialOS folder + files automatically

$root = "C:\primordial-clean\PrimordialOS"

# Create folder structure
New-Item -ItemType Directory -Force -Path $root
New-Item -ItemType Directory -Force -Path "$root\CreationRealm"
New-Item -ItemType Directory -Force -Path "$root\PipelineRealm"
New-Item -ItemType Directory -Force -Path "$root\SchedulerRealm"
New-Item -ItemType Directory -Force -Path "$root\AgentRealm"
New-Item -ItemType Directory -Force -Path "$root\DistributionRealm"
New-Item -ItemType Directory -Force -Path "$root\output"

# -------------------------
# config.json
# -------------------------
@'
{
  "ffmpegPath": "ffmpeg",
  "surfaces": ["tiktok_feed", "youtube_shorts", "instagram_reels"],
  "accounts": ["default"],
  "outputDir": "C:\\primordial-clean\\PrimordialOS\\output"
}
'@ | Set-Content "$root\config.json"

# -------------------------
# core.js
# -------------------------
@'
const creation = require("./CreationRealm/creation");
const pipeline = require("./PipelineRealm/pipeline");
const scheduler = require("./SchedulerRealm/scheduler");
const agents = require("./AgentRealm/agents");
const distribution = require("./DistributionRealm/distribution");

async function mainLoop() {
  console.log("PrimordialOS Autonomous Faceless Empire Engine Online");

  while (true) {
    const task = await agents.decideNextTask();
    const blueprint = await creation.generateBlueprint(task);
    const media = await pipeline.processBlueprint(blueprint);
    const schedule = await scheduler.schedulePost(media);
    await distribution.postMedia(media, schedule);
    await agents.feedbackLoop(media);
    await new Promise(res => setTimeout(res, 2000));
  }
}

mainLoop();
'@ | Set-Content "$root\core.js"

# -------------------------
# CreationRealm/creation.js
# -------------------------
@'
module.exports = {
  async generateBlueprint(task) {
    return {
      id: `content_${Date.now()}`,
      topic: task.topic,
      script: `Faceless script for ${task.topic}`,
      caption: `🔥 ${task.topic} — powered by PrimordialOS`,
      hashtags: ["#primordial", "#origin", "#faceless"],
      surfaceTargets: ["tiktok_feed", "youtube_shorts", "instagram_reels"]
    };
  }
};
'@ | Set-Content "$root\CreationRealm\creation.js"

# -------------------------
# PipelineRealm/pipeline.js
# -------------------------
@'
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const config = require("../config.json");

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout || stderr);
    });
  });
}

module.exports = {
  async processBlueprint(blueprint) {
    const outDir = config.outputDir;
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const rawPath = path.join(outDir, `${blueprint.id}_raw.mp4`);
    const finalPath = path.join(outDir, `${blueprint.id}.mp4`);
    const thumbPath = path.join(outDir, `${blueprint.id}.jpg`);

    fs.writeFileSync(rawPath, "placeholder video");

    const cmdNormalize = `"${config.ffmpegPath}" -y -i "${rawPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:a copy "${finalPath}"`;
    await run(cmdNormalize);

    const cmdThumb = `"${config.ffmpegPath}" -y -i "${finalPath}" -ss 00:00:01 -vframes 1 "${thumbPath}"`;
    await run(cmdThumb);

    const metaOut = await run(`"${config.ffmpegPath}" -i "${finalPath}" 2>&1`);
    const durationMatch = metaOut.match(/Duration: (\d+:\d+:\d+\.\d+)/);
    const resolutionMatch = metaOut.match(/, (\d+x\d+)/);

    const metadata = {
      duration: durationMatch ? durationMatch[1] : "unknown",
      resolution: resolutionMatch ? resolutionMatch[1] : "unknown"
    };

    return {
      ...blueprint,
      filePath: finalPath,
      thumbnail: thumbPath,
      metadata
    };
  }
};
'@ | Set-Content "$root\PipelineRealm\pipeline.js"

# -------------------------
# SchedulerRealm/scheduler.js
# -------------------------
@'
const config = require("../config.json");

module.exports = {
  async schedulePost(media) {
    return {
      surfaces: media.surfaceTargets || config.surfaces,
      accounts: config.accounts,
      postAt: Date.now() + 1000
    };
  }
};
'@ | Set-Content "$root\SchedulerRealm\scheduler.js"

# -------------------------
# AgentRealm/agents.js
# -------------------------
@'
module.exports = {
  async decideNextTask() {
    return {
      topic: "Money hacks"
    };
  },

  async feedbackLoop(media) {
    console.log(`Agent feedback processed for ${media.id}`);
  }
};
'@ | Set-Content "$root\AgentRealm\agents.js"

# -------------------------
# DistributionRealm/distribution.js
# -------------------------
const optimizer = require("./optimizer");

async postToSurface(media, surface, account) {
  const optimized = optimizer.optimizeForPlatform(media, surface);

  console.log(`[DIST] Optimized for ${surface}:`);
  console.log(optimized);

  // Later: replace this with real API upload
  await new Promise(res => setTimeout(res, 500));
}

  async postToSurface(media, surface, account) {
    console.log(`[DIST] Surface=${surface} Account=${account} File=${media.filePath} Thumb=${media.thumbnail}`);
    await new Promise(res => setTimeout(res, 500));
  }
};
'@ | Set-Content "$root\DistributionRealm\distribution.js"

Write-Host "PrimordialOS build complete."
