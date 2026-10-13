import { captureContext, MAX_MESSAGE_LENGTH, readConversation, secureId } from './protocol.js';

export function createChatController({ adapter, getContext = () => null, createId = secureId }) {
  const subscribers = new Set();
  const completedIds = new Set();
  let state = { status: 'idle', conversation: null, draft: '', error: null, pendingMessage: null, canRetry: false };
  let pendingRequest = null;
  let generation = 0;
  let disposed = false;
  let startAttempt;

  function publish(update) {
    if (disposed) return;
    state = { ...state, ...update };
    for (const notify of subscribers) notify();
  }

  function errorFor(error, operation) {
    const hasCode = typeof error?.code === 'string' && typeof error?.message === 'string';
    return { operation, code: hasCode ? error.code : 'TRANSPORT_ERROR', message: hasCode ? error.message : `The demo could not ${operation === 'start' ? 'start' : operation === 'reset' ? 'reset the conversation' : 'confirm the reply'}. Please retry.` };
  }

  function start() {
    if (disposed || state.conversation) return Promise.resolve(false);
    if (state.status === 'starting') return startAttempt;
    const operation = ++generation;
    publish({ status: 'starting', error: null });
    startAttempt = (async () => {
      try {
        const conversation = readConversation(await adapter.startConversation());
        if (disposed || operation !== generation) return false;
        publish({ status: 'ready', conversation });
        return true;
      } catch (error) {
        if (!disposed && operation === generation) publish({ status: 'idle', error: errorFor(error, 'start') });
        return false;
      }
    })();
    return startAttempt;
  }

  async function transmit(request) {
    const operation = ++generation;
    publish({ status: 'sending', error: null, canRetry: false, pendingMessage: { id: `pending-${request.requestId}`, role: 'user', text: request.message } });
    try {
      const conversation = readConversation(await adapter.sendMessage(request), request.conversationId);
      if (disposed || operation !== generation || completedIds.has(request.requestId)) return false;
      completedIds.add(request.requestId);
      pendingRequest = null;
      publish({ status: 'ready', conversation, draft: '', error: null, pendingMessage: null, canRetry: false });
      return true;
    } catch (error) {
      if (!disposed && operation === generation) publish({ status: 'ready', error: errorFor(error, 'send'), canRetry: true });
      return false;
    }
  }

  function send() {
    if (disposed || state.status !== 'ready' || !state.conversation || !state.draft.trim() || state.draft.length > MAX_MESSAGE_LENGTH) return Promise.resolve(false);
    // Calling Send again without editing after a failure is the same retry.
    if (pendingRequest) return transmit(pendingRequest);
    try {
      const requestId = createId();
      if (typeof requestId !== 'string' || !requestId || completedIds.has(requestId)) throw new Error('Could not create a unique request ID.');
      pendingRequest = Object.freeze({ conversationId: state.conversation.id, requestId, message: state.draft.trim(), context: captureContext(getContext()) });
      return transmit(pendingRequest);
    } catch (error) {
      publish({ error: errorFor(error, 'send') });
      return Promise.resolve(false);
    }
  }

  function retry() {
    if (disposed || state.status !== 'ready' || !pendingRequest || !state.canRetry) return Promise.resolve(false);
    return transmit(pendingRequest);
  }

  async function reset() {
    if (disposed || state.status !== 'ready' || !state.conversation) return false;
    const operation = ++generation;
    publish({ status: 'resetting', error: null });
    try {
      const conversation = readConversation(await adapter.resetConversation({ conversationId: state.conversation.id }));
      if (disposed || operation !== generation) return false;
      if (conversation.id === state.conversation.id) throw Object.assign(new Error('The reset did not return a replacement conversation. Please retry.'), { code: 'BACKEND_BAD_RESPONSE' });
      pendingRequest = null;
      completedIds.clear();
      publish({ status: 'ready', conversation, draft: '', error: null, pendingMessage: null, canRetry: false });
      return true;
    } catch (error) {
      if (!disposed && operation === generation) publish({ status: 'ready', error: errorFor(error, 'reset') });
      return false;
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(notify) { subscribers.add(notify); return () => subscribers.delete(notify); },
    start, send, retry, reset,
    setDraft(value) {
      if (disposed || state.status === 'sending' || state.status === 'resetting' || typeof value !== 'string') return;
      const draft = value.slice(0, MAX_MESSAGE_LENGTH);
      if (draft === state.draft) return;
      pendingRequest = null;
      publish({ draft, canRetry: false, pendingMessage: null, error: state.error?.operation === 'send' ? null : state.error });
    },
    dispose() { disposed = true; generation++; pendingRequest = null; subscribers.clear(); },
  };
}
