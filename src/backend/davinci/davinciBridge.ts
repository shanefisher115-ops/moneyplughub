import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export interface TimelineClip {
  name: string;
  filePath: string;
  durationSeconds: number;
  inPoint?: number;
  outPoint?: number;
  trackIndex?: number;
  type: 'video' | 'audio' | 'overlay';
}

export interface DaVinciProjectExport {
  projectName: string;
  timelineName: string;
  frameRate: number;
  width: number;
  height: number;
  lutProfile: 'cyberpunk_emerald' | 'vault_gold' | 'neon_matrix' | 'natural_cinematic';
  clips: TimelineClip[];
}

/**
 * Generates an Apple Final Cut Pro / DaVinci Resolve compatible XML (.fcpxml)
 */
export function generateFCPXML(project: DaVinciProjectExport): string {
  const fps = project.frameRate || 24;
  const timebase = fps;
  const totalFrames = project.clips.reduce((acc, c) => acc + Math.round(c.durationSeconds * fps), 0);

  let clipItemsXml = '';
  let currentStartFrame = 0;

  project.clips.forEach((clip, idx) => {
    const clipFrames = Math.round(clip.durationSeconds * fps);
    const endFrame = currentStartFrame + clipFrames;

    clipItemsXml += `
        <clipitem id="clipitem-${idx + 1}">
          <name>${clip.name}</name>
          <duration>${clipFrames}</duration>
          <rate>
            <timebase>${timebase}</timebase>
            <ntsc>FALSE</ntsc>
          </rate>
          <start>${currentStartFrame}</start>
          <end>${endFrame}</end>
          <in>0</in>
          <out>${clipFrames}</out>
          <file id="file-${idx + 1}">
            <name>${clip.name}</name>
            <pathurl>file://${clip.filePath.replace(/\\/g, '/')}</pathurl>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <duration>${clipFrames}</duration>
            <media>
              <video>
                <samplecharacteristics>
                  <width>${project.width || 1920}</width>
                  <height>${project.height || 1080}</height>
                </samplecharacteristics>
              </video>
            </media>
          </file>
        </clipitem>`;

    if (clip.type === 'video') {
      currentStartFrame = endFrame;
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>${project.projectName}</name>
    <children>
      <sequence id="sequence-1">
        <name>${project.timelineName}</name>
        <duration>${totalFrames}</duration>
        <rate>
          <timebase>${timebase}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <width>${project.width || 1920}</width>
                <height>${project.height || 1080}</height>
                <rate>
                  <timebase>${timebase}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
              </samplecharacteristics>
            </format>
            <track>
              ${clipItemsXml}
            </track>
          </video>
        </media>
      </sequence>
    </children>
  </project>
</xmeml>`;
}

export const davinciRouter = Router();

/**
 * POST /api/davinci/export-timeline
 * Generates and downloads FCPXML project file for DaVinci Resolve
 */
davinciRouter.post('/export-timeline', (req: Request, res: Response) => {
  try {
    const {
      projectName = 'MoneyPlugHub_Creator_Sequence',
      timelineName = 'MoneyOS_Master_Cut',
      frameRate = 24,
      width = 1920,
      height = 1080,
      lutProfile = 'cyberpunk_emerald',
      clips = []
    } = req.body;

    const xmlContent = generateFCPXML({
      projectName,
      timelineName,
      frameRate,
      width,
      height,
      lutProfile,
      clips
    });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${projectName}.xml"`);
    res.send(xmlContent);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/davinci/lut-profiles
 * Returns calibrated LUT profiles for DaVinci Resolve color grading
 */
davinciRouter.get('/lut-profiles', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        id: 'cyberpunk_emerald',
        name: 'Cyberpunk Emerald Glow',
        description: 'MoneyPlugHub signature high-contrast emerald green neon grading with deep OLED shadows.',
        gamma: 'Rec.709',
        targetColorSpace: 'DaVinci Wide Gamut',
      },
      {
        id: 'vault_gold',
        name: 'Living Vault 24K Gold',
        description: 'Rich golden highlights with warm amber tones for wealth and asset showcases.',
        gamma: 'Rec.709',
        targetColorSpace: 'DaVinci Wide Gamut',
      },
      {
        id: 'neon_matrix',
        name: 'Cyber Matrix Cyan & Magenta',
        description: 'Electric cyan and violet dual-tone split-toning for futuristic SaaS and tech b-roll.',
        gamma: 'Rec.709',
        targetColorSpace: 'Rec.709',
      },
      {
        id: 'natural_cinematic',
        name: 'Clean Organic Film Print',
        description: 'Natural Kodak 2383 film emulsion emulation with soft roll-off highlights.',
        gamma: 'Rec.709',
        targetColorSpace: 'Rec.709',
      }
    ]
  });
});
