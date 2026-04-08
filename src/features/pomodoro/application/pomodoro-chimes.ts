import type { PomodoroChimeId, PomodoroPhaseType } from "../domain/pomodoro.types";

interface ToneStep {
  frequency: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

type ChimeProfile = ToneStep[];

interface ChimeDefinition {
  id: PomodoroChimeId;
  label: string;
  mood: "loud" | "relaxed";
  profile: ChimeProfile;
}

let audioContext: AudioContext | null = null;
let audioPrimed = false;
const chimeDefinitions: ChimeDefinition[] = [
  {
    id: "bright-bells",
    label: "Bright Bells",
    mood: "loud",
    profile: [
      { frequency: 880, duration: 0.13, gain: 0.11, type: "triangle" },
      { frequency: 1174, duration: 0.16, gain: 0.11, type: "triangle" },
      { frequency: 1568, duration: 0.26, gain: 0.12, type: "sine" }
    ]
  },
  {
    id: "victory-ping",
    label: "Victory Ping",
    mood: "loud",
    profile: [
      { frequency: 784, duration: 0.14, gain: 0.12, type: "square" },
      { frequency: 1046, duration: 0.16, gain: 0.11, type: "triangle" },
      { frequency: 1318, duration: 0.24, gain: 0.12, type: "triangle" },
      { frequency: 1760, duration: 0.3, gain: 0.1, type: "sine" }
    ]
  },
  {
    id: "triple-rise",
    label: "Triple Rise",
    mood: "loud",
    profile: [
      { frequency: 988, duration: 0.12, gain: 0.1, type: "triangle" },
      { frequency: 1318, duration: 0.12, gain: 0.11, type: "triangle" },
      { frequency: 988, duration: 0.12, gain: 0.1, type: "triangle" },
      { frequency: 1760, duration: 0.28, gain: 0.13, type: "sine" }
    ]
  },
  {
    id: "soft-bloom",
    label: "Soft Bloom",
    mood: "relaxed",
    profile: [
      { frequency: 523, duration: 0.18, gain: 0.07, type: "sine" },
      { frequency: 659, duration: 0.22, gain: 0.07, type: "sine" },
      { frequency: 784, duration: 0.32, gain: 0.075, type: "triangle" }
    ]
  },
  {
    id: "gentle-glass",
    label: "Gentle Glass",
    mood: "relaxed",
    profile: [
      { frequency: 392, duration: 0.22, gain: 0.07, type: "triangle" },
      { frequency: 523, duration: 0.28, gain: 0.065, type: "sine" },
      { frequency: 659, duration: 0.34, gain: 0.07, type: "sine" }
    ]
  },
  {
    id: "quiet-morning",
    label: "Quiet Morning",
    mood: "relaxed",
    profile: [
      { frequency: 440, duration: 0.18, gain: 0.06, type: "sine" },
      { frequency: 554, duration: 0.18, gain: 0.06, type: "triangle" },
      { frequency: 659, duration: 0.28, gain: 0.065, type: "sine" },
      { frequency: 880, duration: 0.34, gain: 0.055, type: "sine" }
    ]
  }
];

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
};

const getDefinition = (chimeId: PomodoroChimeId): ChimeDefinition =>
  chimeDefinitions.find((definition) => definition.id === chimeId) ?? chimeDefinitions[0]!;

export const ensurePomodoroAudioReady = async (): Promise<boolean> => {
  const context = getAudioContext();

  if (!context) {
    return false;
  }

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    // Prime the audio graph during a user gesture so later timer completions can play reliably.
    if (!audioPrimed) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const startAt = context.currentTime + 0.001;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, startAt);
      gainNode.gain.setValueAtTime(0.00001, startAt);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + 0.01);
      audioPrimed = true;
    }

    return true;
  } catch {
    return false;
  }
};

const scheduleTone = (
  context: AudioContext,
  startAt: number,
  step: ToneStep
): number => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = step.type ?? "sine";
  oscillator.frequency.setValueAtTime(step.frequency, startAt);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(step.gain, startAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + Math.max(step.duration, 0.05)
  );

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + step.duration + 0.04);

  return startAt + step.duration;
};

export const playPomodoroCompletionChime = async (
  phaseType: PomodoroPhaseType,
  chimeId: PomodoroChimeId
): Promise<void> => {
  const isReady = await ensurePomodoroAudioReady();
  const context = getAudioContext();

  if (isReady && context) {
    const profile = getDefinition(chimeId).profile;
    let cursor = context.currentTime + 0.02;

    profile.forEach((step, index) => {
      cursor = scheduleTone(context, cursor, step);

      if (index < profile.length - 1) {
        cursor += 0.035;
      }
    });

    return;
  }

  if (typeof window !== "undefined" && typeof window.desktop?.playPomodoroChime === "function") {
    await window.desktop.playPomodoroChime(chimeId);
  }
};

export const previewPomodoroChime = async (chimeId: PomodoroChimeId): Promise<void> => {
  await playPomodoroCompletionChime("work", chimeId);
};

export const pomodoroChimeOptions = chimeDefinitions.map((definition) => ({
  id: definition.id,
  label: definition.label,
  mood: definition.mood
}));
