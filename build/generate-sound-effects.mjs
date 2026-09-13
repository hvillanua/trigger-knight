import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(
  repositoryRoot,
  "src",
  "assets",
  "sound-effects",
);
const SAMPLE_RATE = 22_050;

const SOUND_DEFINITIONS = Object.freeze([
  { name: "ui-activate", duration: 0.07, notes: [[680, 0, 0.07, 0.26]] },
  {
    name: "ui-confirm",
    duration: 0.13,
    notes: [
      [620, 0, 0.07, 0.22],
      [900, 0.055, 0.075, 0.2],
    ],
  },
  {
    name: "ui-cancel",
    duration: 0.13,
    notes: [
      [480, 0, 0.075, 0.2],
      [300, 0.055, 0.075, 0.18],
    ],
  },
  {
    name: "encounter",
    duration: 0.18,
    notes: [
      [420, 0, 0.1, 0.2],
      [620, 0.075, 0.12, 0.2],
    ],
  },
  {
    name: "purchase",
    duration: 0.2,
    notes: [
      [520, 0, 0.09, 0.2],
      [760, 0.065, 0.09, 0.2],
      [1_040, 0.13, 0.09, 0.17],
    ],
  },
  {
    name: "reject",
    duration: 0.16,
    notes: [
      [230, 0, 0.1, 0.23],
      [150, 0.075, 0.095, 0.2],
    ],
  },
  {
    name: "item",
    duration: 0.22,
    notes: [
      [700, 0, 0.1, 0.19],
      [1_000, 0.07, 0.11, 0.19],
      [1_300, 0.14, 0.1, 0.16],
    ],
  },
  {
    name: "battle-start",
    duration: 0.26,
    notes: [
      [180, 0, 0.14, 0.25],
      [360, 0.1, 0.17, 0.23],
      [540, 0.17, 0.13, 0.16],
    ],
  },
  { name: "attack", duration: 0.1, notes: [[260, 0, 0.1, 0.24]] },
  {
    name: "hit",
    duration: 0.12,
    notes: [
      [120, 0, 0.12, 0.25],
      [1_700, 0, 0.035, 0.12],
      [2_400, 0.018, 0.035, 0.1],
      [1_100, 0.04, 0.04, 0.08],
    ],
  },
  {
    name: "lethal",
    duration: 0.22,
    notes: [
      [260, 0, 0.12, 0.22],
      [170, 0.09, 0.14, 0.2],
    ],
  },
  {
    name: "reward",
    duration: 0.28,
    notes: [
      [520, 0, 0.1, 0.18],
      [780, 0.075, 0.1, 0.18],
      [1_040, 0.15, 0.14, 0.18],
    ],
  },
  {
    name: "achievement",
    duration: 0.36,
    notes: [
      [520, 0, 0.13, 0.17],
      [780, 0.095, 0.14, 0.17],
      [1_040, 0.19, 0.18, 0.17],
      [1_300, 0.27, 0.13, 0.13],
    ],
  },
  {
    name: "death",
    duration: 0.4,
    notes: [
      [420, 0, 0.16, 0.22],
      [300, 0.12, 0.18, 0.2],
      [190, 0.25, 0.17, 0.18],
    ],
  },
]);

function writeAscii(buffer, offset, value) {
  buffer.write(value, offset, "ascii");
}

function createWav(definition) {
  const frameCount = Math.ceil(definition.duration * SAMPLE_RATE);
  const dataLength = frameCount * 2;
  const wav = Buffer.alloc(44 + dataLength);
  writeAscii(wav, 0, "RIFF");
  wav.writeUInt32LE(36 + dataLength, 4);
  writeAscii(wav, 8, "WAVE");
  writeAscii(wav, 12, "fmt ");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  writeAscii(wav, 36, "data");
  wav.writeUInt32LE(dataLength, 40);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    let sample = 0;
    for (const [frequency, start, duration, amplitude] of definition.notes) {
      const progress = (time - start) / duration;
      if (progress < 0 || progress >= 1) continue;
      const attack = Math.min(1, progress * 80);
      const release = Math.min(1, (1 - progress) * 18);
      const envelope = Math.min(attack, release);
      sample += Math.sin(2 * Math.PI * frequency * time) * amplitude * envelope;
    }
    const pcm = Math.max(-1, Math.min(1, sample));
    wav.writeInt16LE(Math.round(pcm * 32_000), 44 + frame * 2);
  }
  return wav;
}

mkdirSync(outputDirectory, { recursive: true });
for (const definition of SOUND_DEFINITIONS) {
  writeFileSync(
    path.join(outputDirectory, `${definition.name}.wav`),
    createWav(definition),
  );
}
