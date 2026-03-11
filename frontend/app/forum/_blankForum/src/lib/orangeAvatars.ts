import orange1 from '@/assets/avatars/orange-1.png';
import orange2 from '@/assets/avatars/orange-2.png';
import orange3 from '@/assets/avatars/orange-3.png';
import orange4 from '@/assets/avatars/orange-4.png';
import orange5 from '@/assets/avatars/orange-5.png';
import orange6 from '@/assets/avatars/orange-6.png';
import orange7 from '@/assets/avatars/orange-7.png';
import orange8 from '@/assets/avatars/orange-8.png';
import orange9 from '@/assets/avatars/orange-9.png';
import orange10 from '@/assets/avatars/orange-10.png';

const ORANGE_AVATARS = [
  orange1, orange2, orange3, orange4, orange5,
  orange6, orange7, orange8, orange9, orange10,
];

/** Get a deterministic orange avatar based on an index or string */
export function getOrangeAvatar(seed: number | string): string {
  const index = typeof seed === 'string'
    ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    : seed;
  return ORANGE_AVATARS[index % ORANGE_AVATARS.length];
}
