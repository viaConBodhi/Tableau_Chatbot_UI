import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { MAX_MESSAGE_LENGTH, safeSourceUrl } from './protocol.js';

function Author({ role }) {
  return <span className="message-role"><span className="author-avatar" aria-hidden="true">{role === 'user' ? 'Y' : 'AI'}</span><span>{role === 'user' ? 'You' : 'AI assistant'}</span></span>;
}

function Sources({ sources }) {
  return <details className="message-sources">
    <summary>Sources ({sources.length})</summary>
    <ol className="source-list" aria-label="Cited sources">
      {sources.map((source, index) => {
        const title = source.title || 'Untitled source';
        const url = safeSourceUrl(source.url);
        return <li className="source-item" key={`${source.chunk_id || source.source_id || title}-${index}`}>
          <span className="source-rank" aria-label={`Source ${index + 1}`}>{index + 1}</span>
          <div className="source-content">
            <strong>{title}</strong>
            {source.citation_id && source.citation_id !== index + 1 && <span className="source-citation">Cited as [{source.citation_id}] in the answer</span>}
            {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} in a new tab`}>Open source</a> : <span className="source-unavailable">Source URL unavailable</span>}
            <details className="source-evidence"><summary>Quoted evidence</summary><blockquote>{source.excerpt || 'Evidence excerpt unavailable.'}</blockquote>{source.excerpt_truncated && <p>Evidence preview truncated.</p>}</details>
          </div>
        </li>;
      })}
    </ol>
  </details>;
}

export default function ChatPanel({ chat, visible }) {
  const state = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  const messagesRef = useRef(null);
  const scrollPosition = useRef(0);
  const previous = useRef({ conversation: null, status: 'idle' });
  const newContentWhileHidden = useRef(false);
  const sending = state.status === 'sending';
  const busy = sending || state.status === 'starting' || state.status === 'resetting';

  useLayoutEffect(() => {
    const changed = previous.current.conversation !== state.conversation || previous.current.status !== state.status;
    previous.current = { conversation: state.conversation, status: state.status };
    if (!visible) { if (changed) newContentWhileHidden.current = true; return; }
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTop = changed || newContentWhileHidden.current ? node.scrollHeight : scrollPosition.current;
    scrollPosition.current = node.scrollTop;
    newContentWhileHidden.current = false;
  }, [visible, state.conversation, state.status]);

  return <div className="chat-pane">
    <div className="chat-toolbar">
      <button type="button" className="secondary-button" onClick={() => void chat.reset()} disabled={busy || !state.conversation}>New conversation</button>
      <span className="conversation-status" role="status">{state.status === 'resetting' ? 'Starting over…' : state.status === 'starting' ? 'Starting conversation…' : ''}</span>
    </div>
    <div className="messages-panel" role="log" aria-label="Conversation" aria-live="polite" ref={messagesRef} onScroll={() => { if (visible) scrollPosition.current = messagesRef.current.scrollTop; }}>
      {state.conversation?.messages.map(item => <article className={`message message--${item.role}`} key={item.id}><Author role={item.role} /><p>{item.text}</p>{item.sources?.length > 0 && <Sources sources={item.sources} />}</article>)}
      {state.pendingMessage && <article className="message message--user message--unconfirmed"><Author role="user" /><p>{state.pendingMessage.text}</p><small>{sending ? 'Sending…' : 'Awaiting confirmed reply'}</small></article>}
      {sending && <article className="message message--assistant message--pending"><Author role="assistant" /><p>Preparing response…</p></article>}
      {!state.conversation && !busy && !state.error && <p className="loading-state">Starting conversation…</p>}
    </div>
    {state.error && <div className="error-banner" role="alert"><span>{state.error.message}</span>{state.error.operation === 'start' && <button type="button" onClick={() => void chat.start()}>Retry conversation</button>}{state.canRetry && <button type="button" disabled={busy} onClick={() => void chat.retry()}>Retry message</button>}</div>}
    <form className="composer" onSubmit={event => { event.preventDefault(); void chat.send(); }}>
      <label htmlFor="chat-message">Message</label>
      <div className="composer-row"><textarea id="chat-message" rows="2" maxLength={MAX_MESSAGE_LENGTH} value={state.draft} onChange={event => chat.setDraft(event.target.value)} placeholder="Ask a question" disabled={busy || !state.conversation} aria-describedby="demo-notice" /><button type="submit" disabled={busy || !state.conversation || !state.draft.trim()}>{sending ? 'Sending…' : 'Send'}</button></div>
      <div className="composer-hints"><span>Enter adds a new line</span><span>{state.draft.length}/{MAX_MESSAGE_LENGTH}</span></div>
      <p className="demo-notice" id="demo-notice">Phase 1 demo — no backend connected</p>
    </form>
  </div>;
}
