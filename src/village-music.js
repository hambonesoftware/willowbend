const melodies = {
  Morning: [57, 64, 69, 64, 59, 62, 67, 62],
  Afternoon: [60, 64, 67, 72, 62, 65, 69, 65],
  Evening: [57, 60, 64, 60, 55, 59, 62, 59],
  Night: [52, 59, 64, 59, 50, 57, 62, 57],
  Festival: [60, 64, 67, 72, 69, 67, 64, 67],
};

export function villageMusic() {
  let audio, next = 0, index = 0, melody = null, enabled = false;
  function toggle() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) return false;
    audio ??= new Audio();
    enabled = !enabled;
    if (enabled) audio.resume().catch(() => {});
    else audio.suspend().catch(() => {});
    return enabled;
  }

  function update(phase) {
    if (!enabled || audio?.state !== 'running') return;
    if (melody !== melodies[phase]) {
      melody = melodies[phase];
      index = 0;
    }
    const now = audio.currentTime;
    if (now < next) return;
    const note = audio.createOscillator(), volume = audio.createGain();
    note.type = 'sine';
    note.frequency.value = 440 * 2 ** ((melody[index] - 69) / 12);
    note.connect(volume).connect(audio.destination);
    volume.gain.setValueAtTime(0, now);
    volume.gain.linearRampToValueAtTime(.024, now + .035);
    volume.gain.exponentialRampToValueAtTime(.0002, now + .65);
    note.start(now);
    note.stop(now + .68);
    index = (index + 1) % melody.length;
    next = now + (phase === 'Night' ? 1.1 : phase === 'Festival' ? .58 : .8);
  }

  return { toggle, update };
}
