// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MANIFESTS, makeManifest, validateManifest } from '../scripts/manifests.mjs';

describe('manifest generation and validation', () => {
  it('produces valid distinguishable environments with correctly sized PNG icons', async () => {
    const icon = await sharp({ create: { width: 70, height: 70, channels: 4, background: '#243447' } }).png().toBuffer();
    expect(new Set(MANIFESTS.map(item => item.id)).size).toBe(3);
    for (const configuration of MANIFESTS) {
      const xml = makeManifest(configuration, icon.toString('base64'));
      expect(validateManifest(xml, configuration)['source-location'].url).toBe(configuration.url);
      expect(validateManifest(xml, configuration).author['@_email']).toBe('infoserv@vcu.edu');
      expect(() => validateManifest(`\uFEFF${xml}`, configuration)).toThrow(/byte zero/);
      expect(() => validateManifest(xml.replace(configuration.url, 'https://wrong.example/'), configuration)).toThrow(/environment URL/);
      expect(() => validateManifest(xml.replace('</manifest>', '</broken>'), configuration)).toThrow(/invalid XML/);
    }
  });

  it('rejects missing or empty author email before Tableau loads any environment', async () => {
    const icon = await sharp({ create: { width: 70, height: 70, channels: 4, background: '#243447' } }).png().toBuffer();
    for (const configuration of MANIFESTS) {
      const xml = makeManifest(configuration, icon.toString('base64'));
      for (const replacement of ['', ' email=""', ' email="   "']) {
        const invalid = xml.replace(' email="infoserv@vcu.edu"', replacement);
        expect(() => validateManifest(invalid, configuration)).toThrow(/required author email/);
      }
    }
  });
});
