const reset = '\x1b[0m';

export const escapeCodes = {
  reset,
  clear: '\x1b[g',
  red: '\x1b[1;31m',
};

export const coloredText = {
  red: (text: string) => `${escapeCodes.red}${text}${reset}`,
};
