/**
 * Parse a Life rule string (e.g. B3/S23) into lookup masks.
 * @param {string} ruleString
 * @returns {{ rule: string, birthMask: boolean[], surviveMask: boolean[] }}
 */
export function parseLifeRule(ruleString) {
  const defaultRule = {
    rule: 'B3/S23',
    birthMask: (() => {
      const arr = new Array(9).fill(false);
      arr[3] = true;
      return arr;
    })(),
    surviveMask: (() => {
      const arr = new Array(9).fill(false);
      arr[2] = true;
      arr[3] = true;
      return arr;
    })(),
  };

  if (!ruleString) return defaultRule;

  const cleaned = ruleString.trim().toUpperCase();
  const match = cleaned.match(/^B(\d*)\/?S(\d*)$/);
  if (!match) return defaultRule;

  const parseDigits = (digits) =>
    [...new Set(digits.split('').map((d) => parseInt(d, 10)).filter((n) => n >= 0 && n <= 8))];

  const birthDigits = parseDigits(match[1]);
  const surviveDigits = parseDigits(match[2]);

  if (birthDigits.length === 0 && surviveDigits.length === 0) {
    return defaultRule;
  }

  const birthMask = new Array(9).fill(false);
  birthDigits.forEach((n) => {
    birthMask[n] = true;
  });

  const surviveMask = new Array(9).fill(false);
  surviveDigits.forEach((n) => {
    surviveMask[n] = true;
  });

  const normalized = `B${birthDigits.join('')}/S${surviveDigits.join('')}`;

  return { rule: normalized, birthMask, surviveMask };
}
