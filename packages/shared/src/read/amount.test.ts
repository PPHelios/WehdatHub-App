import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import cases from './money-cases.fixture.json';
import { readAmount, readAmounts, readWhole } from './amount';

describe('amount reader (same cases as the server)', () => {
  for (const c of cases as { text: string; value: number }[]) {
    it(`${c.text} -> ${c.value}`, () => expect(readAmount(c.text)?.value).toBe(c.value));
  }
  it('not money', () => {
    for (const t of ['شقة 3 غرف', '120 متر', '10%', '01012345678', 'الدور 5']) expect(readAmount(t)).toBeNull();
  });
  it('sure flag', () => {
    expect(readAmounts('3500000 4000000').every((a) => !a.sure)).toBe(true);
    expect(readAmount('3.5 مليون')?.sure).toBe(true);
  });
  it('readWhole', () => {
    expect(readWhole('٣ ونص مليون جنيه')).toBe(3500000);
    expect(readWhole('شقة 3 مليون')).toBeNull();
  });
});

// Skips when the server repo is not next to this one (CI of the app alone).
const serverFile = path.resolve(__dirname, '../../../../../WehdatHub-Server/domain/read/amount.js');
const require = createRequire(import.meta.url);
describe.skipIf(!existsSync(serverFile))('amount reader matches the server file', () => {
  it('reads every case and probe the same way', () => {
    const server = require(serverFile);
    const probes = [
      ...(cases as { text: string }[]).map((c) => c.text),
      'تلاتة مليون ونص', '3 مليون و 2 غرف', '$250000', '3500000 xyzq', '15م', '50-55k', 'مساحة 150 بسعر 4 مليون', '2.5 مليون جنيه كاش',
    ];
    for (const t of probes) expect(readAmounts(t), t).toEqual(server.readAmounts(t));
  });
});
