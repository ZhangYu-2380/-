const SOUND_ENABLED_KEY = "broker-monitor-alarm-sound-enabled";
let audioContext: AudioContext | null = null;

export function isAlarmSoundEnabled() {
  return typeof window !== "undefined" && window.localStorage.getItem(SOUND_ENABLED_KEY) === "true";
}

export function setAlarmSoundEnabled(enabled: boolean) {
  window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

export async function playAlarmSound() {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  await audioContext.resume();
  [0, 0.32, 0.64].forEach((offset, index) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(index % 2 === 0 ? 880 : 660, audioContext!.currentTime + offset);
    gain.gain.setValueAtTime(0.0001, audioContext!.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.16, audioContext!.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext!.currentTime + offset + 0.25);
    oscillator.connect(gain).connect(audioContext!.destination);
    oscillator.start(audioContext!.currentTime + offset);
    oscillator.stop(audioContext!.currentTime + offset + 0.26);
  });
}

