 import { useCallback, useRef } from 'react';
 
 export function useCoinSound() {
   const audioContextRef = useRef<AudioContext | null>(null);
 
   const playSound = useCallback(() => {
     // Create or reuse AudioContext
     if (!audioContextRef.current) {
       audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
     }
     const ctx = audioContextRef.current;
 
     // Resume if suspended (browser autoplay policy)
     if (ctx.state === 'suspended') {
       ctx.resume();
     }
 
     const now = ctx.currentTime;
 
     // Create oscillator for the main coin sound
     const osc1 = ctx.createOscillator();
     const osc2 = ctx.createOscillator();
     const gainNode = ctx.createGain();
 
     // Classic 8-bit coin sound: two quick ascending notes
     osc1.type = 'square';
     osc2.type = 'square';
 
     // First note - B5 (988 Hz)
     osc1.frequency.setValueAtTime(988, now);
     // Second note - E6 (1319 Hz) 
     osc2.frequency.setValueAtTime(1319, now + 0.08);
 
     // Volume envelope
     gainNode.gain.setValueAtTime(0.15, now);
     gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
 
     // Connect oscillators
     osc1.connect(gainNode);
     osc2.connect(gainNode);
     gainNode.connect(ctx.destination);
 
     // Play the sound
     osc1.start(now);
     osc1.stop(now + 0.08);
     osc2.start(now + 0.08);
     osc2.stop(now + 0.2);
   }, []);
 
   return { playSound };
 }