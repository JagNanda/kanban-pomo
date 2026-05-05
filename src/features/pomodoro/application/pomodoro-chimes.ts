import type { PomodoroChimeId, PomodoroPhaseType } from "../domain/pomodoro.types";

interface ToneStep {
  frequency: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  pauseAfter?: number;
  slideToFrequency?: number;
  accentFrequency?: number;
  accentGain?: number;
  accentType?: OscillatorType;
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
      { frequency: 1046, duration: 0.1, gain: 0.28, type: "triangle", accentFrequency: 2093, accentGain: 0.11 },
      { frequency: 1397, duration: 0.12, gain: 0.3, type: "triangle", pauseAfter: 0.025, accentFrequency: 2794, accentGain: 0.1 },
      { frequency: 1760, duration: 0.2, gain: 0.32, type: "sine", accentFrequency: 3520, accentGain: 0.08 },
      { frequency: 2349, duration: 0.24, gain: 0.26, type: "sine" }
    ]
  },
  {
    id: "victory-ping",
    label: "Victory Ping",
    mood: "loud",
    profile: [
      { frequency: 523, duration: 0.12, gain: 0.3, type: "square", pauseAfter: 0.045 },
      { frequency: 659, duration: 0.12, gain: 0.28, type: "square", pauseAfter: 0.04 },
      { frequency: 784, duration: 0.16, gain: 0.32, type: "sawtooth", accentFrequency: 1175, accentGain: 0.1 },
      { frequency: 1046, duration: 0.34, gain: 0.34, type: "triangle", accentFrequency: 2093, accentGain: 0.08 }
    ]
  },
  {
    id: "triple-rise",
    label: "Triple Rise",
    mood: "loud",
    profile: [
      { frequency: 440, duration: 0.11, gain: 0.27, type: "triangle", pauseAfter: 0.075 },
      { frequency: 660, duration: 0.11, gain: 0.3, type: "triangle", pauseAfter: 0.075 },
      { frequency: 880, duration: 0.13, gain: 0.33, type: "triangle", pauseAfter: 0.075 },
      { frequency: 1320, duration: 0.32, gain: 0.31, type: "sine" }
    ]
  },
  {
    id: "soft-bloom",
    label: "Soft Bloom",
    mood: "relaxed",
    profile: [
      { frequency: 330, duration: 0.3, gain: 0.18, type: "sine", attack: 0.045, release: 0.16, accentFrequency: 495, accentGain: 0.06 },
      { frequency: 392, duration: 0.34, gain: 0.2, type: "sine", attack: 0.045, release: 0.18, accentFrequency: 587, accentGain: 0.07 },
      { frequency: 494, duration: 0.46, gain: 0.21, type: "triangle", attack: 0.055, release: 0.22, accentFrequency: 740, accentGain: 0.06 }
    ]
  },
  {
    id: "gentle-glass",
    label: "Gentle Glass",
    mood: "relaxed",
    profile: [
      { frequency: 740, duration: 0.18, gain: 0.19, type: "sine", pauseAfter: 0.055, accentFrequency: 1480, accentGain: 0.07 },
      { frequency: 988, duration: 0.2, gain: 0.2, type: "sine", pauseAfter: 0.065, accentFrequency: 1976, accentGain: 0.075 },
      { frequency: 1245, duration: 0.22, gain: 0.2, type: "triangle", pauseAfter: 0.08 },
      { frequency: 1661, duration: 0.38, gain: 0.17, type: "sine", release: 0.2 }
    ]
  },
  {
    id: "quiet-morning",
    label: "Quiet Morning",
    mood: "relaxed",
    profile: [
      { frequency: 392, duration: 0.24, gain: 0.17, type: "sine", attack: 0.035, release: 0.15 },
      { frequency: 330, duration: 0.24, gain: 0.18, type: "triangle", attack: 0.035, release: 0.15, pauseAfter: 0.05 },
      { frequency: 494, duration: 0.32, gain: 0.19, type: "sine", attack: 0.04, release: 0.18 },
      { frequency: 659, duration: 0.42, gain: 0.16, type: "sine", attack: 0.05, release: 0.24 }
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
  const compressor = context.createDynamicsCompressor();
  let accentOscillator: OscillatorNode | null = null;
  let accentGainNode: GainNode | null = null;
  const attack = step.attack ?? 0.012;
  const release = step.release ?? 0.09;
  const endAt = startAt + Math.max(step.duration, attack + release + 0.025);
  const sustainUntil = Math.max(startAt + attack + 0.001, endAt - release);

  oscillator.type = step.type ?? "sine";
  oscillator.frequency.setValueAtTime(step.frequency, startAt);
  if (step.slideToFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(step.slideToFrequency, sustainUntil);
  }

  compressor.threshold.setValueAtTime(-12, startAt);
  compressor.knee.setValueAtTime(12, startAt);
  compressor.ratio.setValueAtTime(7, startAt);
  compressor.attack.setValueAtTime(0.004, startAt);
  compressor.release.setValueAtTime(0.16, startAt);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(step.gain, startAt + attack);
  gainNode.gain.setValueAtTime(step.gain, sustainUntil);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(compressor);
  compressor.connect(context.destination);

  if (step.accentFrequency && step.accentGain) {
    accentOscillator = context.createOscillator();
    accentGainNode = context.createGain();

    accentOscillator.type = step.accentType ?? "sine";
    accentOscillator.frequency.setValueAtTime(step.accentFrequency, startAt);
    accentGainNode.gain.setValueAtTime(0.0001, startAt);
    accentGainNode.gain.exponentialRampToValueAtTime(step.accentGain, startAt + attack);
    accentGainNode.gain.setValueAtTime(step.accentGain, sustainUntil);
    accentGainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);
    accentOscillator.connect(accentGainNode);
    accentGainNode.connect(compressor);
    accentOscillator.start(startAt);
    accentOscillator.stop(endAt + 0.04);
  }

  oscillator.start(startAt);
  oscillator.stop(endAt + 0.04);

  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
    accentOscillator?.disconnect();
    accentGainNode?.disconnect();
    compressor.disconnect();
  };

  return endAt + (step.pauseAfter ?? 0);
};

export const playPomodoroCompletionChime = async (
  phaseType: PomodoroPhaseType,
  chimeId: PomodoroChimeId
): Promise<void> => {
  if (
    typeof window !== "undefined" &&
    typeof window.desktop?.playPomodoroChime === "function" &&
    document.visibilityState === "hidden"
  ) {
    await window.desktop.playPomodoroChime(chimeId);
    return;
  }

  const isReady = await ensurePomodoroAudioReady();
  const context = getAudioContext();

  if (isReady && context) {
    const profile = getDefinition(chimeId).profile;
    let cursor = context.currentTime + 0.02;

    profile.forEach((step, index) => {
      cursor = scheduleTone(context, cursor, step);

      if (index < profile.length - 1) {
        cursor += 0.02;
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
