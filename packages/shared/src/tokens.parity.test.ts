import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLORS, SHAPE } from './tokens';

const serverFile = path.resolve(__dirname, '../../../../WehdatHub-Server/domain/designTokens.js');
const require = createRequire(import.meta.url);

// Skips when the server repo is not next to this one (CI of the app alone).
describe.skipIf(!existsSync(serverFile))('tokens match the server', () => {
  it('has the same colours in both modes', () => {
    const server = require(serverFile);
    expect(COLORS).toEqual(server.COLORS);
  });
  it('has the same shape values', () => {
    const server = require(serverFile);
    expect(SHAPE).toEqual(server.SHAPE);
  });
});
