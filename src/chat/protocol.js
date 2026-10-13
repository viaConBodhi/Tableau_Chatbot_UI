export const MAX_MESSAGE_LENGTH = 2000;

export function secureId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Secure browser randomness is unavailable.');
}

export function safeSourceUrl(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function badResponse() {
  return Object.assign(new Error('The reply had an unexpected format. Please retry.'), { code: 'BACKEND_BAD_RESPONSE' });
}

function sourceValue(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw badResponse();
  const result = {};
  for (const field of ['title', 'url', 'excerpt', 'chunk_id', 'source_id']) {
    if (source[field] !== undefined) {
      if (typeof source[field] !== 'string') throw badResponse();
      result[field] = source[field];
    }
  }
  if (source.citation_id !== undefined) {
    const number = Number(source.citation_id);
    if (!Number.isSafeInteger(number) || number < 1) throw badResponse();
    result.citation_id = number;
  }
  if (source.excerpt_truncated !== undefined) {
    if (typeof source.excerpt_truncated !== 'boolean') throw badResponse();
    result.excerpt_truncated = source.excerpt_truncated;
  }
  return Object.freeze(result);
}

// Validate and copy the gateway-shaped envelope before exposing it to React.
// Rendering treats all text as plain text; unsafe source URLs remain unlinked.
export function readConversation(response, expectedId) {
  if (!response || typeof response !== 'object' || Array.isArray(response) || typeof response.ok !== 'boolean') throw badResponse();
  if (!response.ok) {
    if (typeof response.code !== 'string' || !response.code || typeof response.message !== 'string' || !response.message) throw badResponse();
    throw Object.assign(new Error(response.message), { code: response.code });
  }
  const conversation = response.conversation;
  if (!conversation || typeof conversation.id !== 'string' || !conversation.id.trim() || !Array.isArray(conversation.messages)) throw badResponse();
  if (expectedId && conversation.id !== expectedId) throw badResponse();
  const byId = new Map();
  for (const item of conversation.messages) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || !['user', 'assistant'].includes(item.role) || typeof item.text !== 'string') throw badResponse();
    if (item.sources !== undefined && !Array.isArray(item.sources)) throw badResponse();
    const message = Object.freeze({
      id: item.id,
      role: item.role,
      text: item.text,
      ...(item.sources === undefined ? {} : { sources: Object.freeze(item.sources.map(sourceValue)) }),
    });
    if (byId.has(item.id) && JSON.stringify(byId.get(item.id)) !== JSON.stringify(message)) throw badResponse();
    byId.set(item.id, message);
  }
  return Object.freeze({ id: conversation.id, messages: Object.freeze([...byId.values()]) });
}

export function captureContext(context) {
  if (context === null) return null;
  if (!context || typeof context.dashboardName !== 'string' || !Array.isArray(context.worksheetNames) || context.worksheetNames.some(name => typeof name !== 'string')) {
    throw Object.assign(new Error('The dashboard names could not be read. Please retry.'), { code: 'CONTEXT_UNAVAILABLE' });
  }
  return Object.freeze({ dashboardName: context.dashboardName, worksheetNames: Object.freeze([...context.worksheetNames]) });
}
