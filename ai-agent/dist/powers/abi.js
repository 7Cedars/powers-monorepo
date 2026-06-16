import powers from './Powers.json' with { type: 'json' };
export const powersAbi = JSON.parse(JSON.stringify(powers.abi));
