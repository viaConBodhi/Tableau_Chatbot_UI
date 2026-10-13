import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

export const MANIFEST_NAMESPACE = 'http://www.tableau.com/xml/extension_manifest';
export const MANIFESTS = [
  { file: 'AIGuide.local.trex', name: 'AI Guide (local)', id: 'com.github.viaconbodhi.cctr.aiguide.local', url: 'http://localhost:5173/' },
  { file: 'AIGuide.dev.trex', name: 'AI Guide (dev)', id: 'com.github.viaconbodhi.cctr.aiguide.dev', url: 'https://dev-tableau-chatbot-ui.algo-alert-cramer.workers.dev/' },
  { file: 'AIGuide.trex', name: 'AI Guide', id: 'com.github.viaconbodhi.cctr.aiguide', url: 'https://tableau-chatbot-ui.algo-alert-cramer.workers.dev/' },
];

export function makeManifest(configuration, iconBase64) {
  const builder = new XMLBuilder({ ignoreAttributes: false, format: true, suppressEmptyNode: true });
  const body = builder.build({
    manifest: {
      '@_manifest-version': '0.1',
      '@_xmlns': MANIFEST_NAMESPACE,
      'dashboard-extension': {
        '@_id': configuration.id,
        '@_extension-version': '0.1.0',
        'default-locale': 'en_US',
        name: { '@_resource-id': 'name' },
        description: 'CCTR AI Guide Phase 1 resize diagnostic. No backend connected.',
        author: {
          '@_name': 'CCTR',
          '@_email': 'infoserv@vcu.edu',
          '@_organization': 'CCTR',
          '@_website': 'https://github.com/viaConBodhi/Tableau_Chatbot_UI',
        },
        'min-api-version': '1.7',
        'source-location': { url: configuration.url },
        icon: iconBase64,
      },
      resources: { resource: { '@_id': 'name', text: { '@_locale': 'en_US', '#text': configuration.name } } },
    },
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n${body}`;
}

export function validateManifest(xml, expected) {
  if (!xml.startsWith('<?xml ')) throw new Error(`${expected.file}: XML declaration must start at byte zero.`);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error(`${expected.file}: DTDs and entities are not allowed.`);
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`${expected.file}: invalid XML (${validation.err.msg}).`);
  const document = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml);
  const manifest = document.manifest;
  const extension = manifest?.['dashboard-extension'];
  if (manifest?.['@_xmlns'] !== MANIFEST_NAMESPACE || manifest?.['@_manifest-version'] !== '0.1') {
    throw new Error(`${expected.file}: wrong manifest namespace or version.`);
  }
  if (extension?.['@_id'] !== expected.id || extension?.['@_extension-version'] !== '0.1.0') {
    throw new Error(`${expected.file}: incorrect extension ID or version.`);
  }
  if (extension?.['source-location']?.url !== expected.url) throw new Error(`${expected.file}: incorrect environment URL.`);
  if (extension?.['min-api-version'] !== '1.7' || 'permissions' in extension) {
    throw new Error(`${expected.file}: unexpected API requirements or data permissions.`);
  }
  if (extension.author?.['@_name'] !== 'CCTR' || !extension.author?.['@_website']?.startsWith('https://')) {
    throw new Error(`${expected.file}: missing author or HTTPS support website.`);
  }
  // Tableau's Author-CT schema requires email, although the prose API docs omit it.
  if (typeof extension.author?.['@_email'] !== 'string' || !extension.author['@_email'].trim()) {
    throw new Error(`${expected.file}: missing required author email.`);
  }
  if (manifest.resources?.resource?.text?.['#text'] !== expected.name) throw new Error(`${expected.file}: incorrect display name.`);
  const icon = Buffer.from(extension.icon || '', 'base64');
  if (icon.length < 24 || icon.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || icon.readUInt32BE(16) !== 70 || icon.readUInt32BE(20) !== 70) {
    throw new Error(`${expected.file}: icon must be a 70 × 70 PNG.`);
  }
  return extension;
}
