import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

function renderTextWithCitations(text, sourceLookup) {
  const parts = text.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);

    if (!match) {
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    }

    const citationNumber = Number.parseInt(match[1], 10);
    const source = sourceLookup[citationNumber];

    if (!source?.url) {
      return <span key={`citation-${citationNumber}-${index}`}>{part}</span>;
    }

    return (
      <a
        key={`citation-${citationNumber}-${index}`}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-citation"
        title={source.title}
      >
        {part}
      </a>
    );
  });
}

function renderParagraphs(text, sourceLookup) {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 24)}-${index}`}>
        {renderTextWithCitations(paragraph, sourceLookup)}
      </p>
    ));
}

function AssistantMessage({ msg }) {
  const sourceLookup = useMemo(() => {
    const entries = (msg.sourceCards || msg.sources || []).map((source) => [source.citationNumber, source]);
    return Object.fromEntries(entries);
  }, [msg.sourceCards, msg.sources]);

  const sections = msg.sections;
  const sourceIndex = msg.sourceIndex || [];
  const sourceCards = msg.sourceCards || msg.sources || [];
  const confidence = msg.citations?.confidence;

  if (!sections) {
    return <div className="answer">{msg.content}</div>;
  }

  return (
    <>
      <div className="response-section">
        <h3>Answer</h3>
        <div className="answer">{renderParagraphs(sections.answer, sourceLookup)}</div>
      </div>

      <div className="response-section">
        <h3>Key Data Points</h3>
        <ul className="key-points">
          {sections.keyPoints.map((point, index) => (
            <li key={`${point.slice(0, 24)}-${index}`}>
              {renderTextWithCitations(point, sourceLookup)}
            </li>
          ))}
        </ul>
      </div>

      {msg.sourceCoverage?.categories?.length > 0 && (
        <div className="response-section">
          <h3>Source Coverage</h3>
          <p className="coverage-line">
            Categories used: {msg.sourceCoverage.categories.join(', ')}
          </p>
        </div>
      )}

      <div className="response-section">
        <h3>Sources</h3>
        <div className="source-index-list">
          {sourceIndex.map((source) => (
            <div key={source.citationNumber} className="source-index-item" id={`source-${source.citationNumber}`}>
              <div className="source-index-title">
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  [{source.citationNumber}] {source.title}
                </a>
              </div>
              <div className="source-index-meta">Domain: {source.domain}</div>
              <div className="source-index-meta">Type: {source.type}</div>
              <div className="source-index-meta">Relevance: {source.relevance}%</div>
              <div className="source-index-summary">Summary: {source.summary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="response-section">
        <h3>Evidence Panel</h3>
        <div className="source-cards">
          {sourceCards.map((source) => (
            <a
              key={source.citationNumber}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-card"
            >
              <div className="source-card-header">
                <h4>[{source.citationNumber}] {source.title}</h4>
                <span className="source-type">{source.category}</span>
              </div>

              <div className="source-domain">{source.domain}</div>
              <div className="source-metrics">
                <div className="metric">
                  <span className="metric-label">Relevance</span>
                  <span className="metric-value">{source.relevanceScore}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Credibility</span>
                  <span className="metric-value">{source.credibilityScore}</span>
                </div>
              </div>
              <div className="source-description">{source.keyInsight}</div>
              <div className="source-snippet">{source.snippet}</div>
            </a>
          ))}
        </div>
      </div>

      <div className="response-section">
        <h3>Confidence Level</h3>
        <div className={`confidence-chip confidence-${confidence?.level?.toLowerCase() || 'low'}`}>
          {confidence?.level || 'Low'} {confidence ? `(${confidence.score})` : ''}
        </div>
        {confidence?.reason && <p className="confidence-reason">{confidence.reason}</p>}
      </div>

      {msg.metadata && (
        <div className="metadata">
          <small>
            {msg.metadata.totalTime} | {msg.metadata.mode} mode | {msg.metadata.sourceCount} sources
          </small>
        </div>
      )}
    </>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('default');
  const [depth, setDepth] = useState('standard');
  const messagesEndRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    const conversationId = currentConversationId || `conv_${Date.now()}`;

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query.trim(),
          conversationId,
          mode,
          depth
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Error: ${data.error}`);
        return;
      }

      setCurrentConversationId(conversationId);
      setConversations((prev) => [
        ...prev,
        {
          type: 'user',
          content: query,
          timestamp: new Date()
        },
        {
          type: 'assistant',
          content: data.response,
          sections: data.sections,
          sources: data.sources,
          sourceIndex: data.sourceIndex,
          sourceCards: data.sourceCards,
          sourceCoverage: data.sourceCoverage,
          citations: data.citations,
          metadata: data.metadata,
          timestamp: new Date()
        }
      ]);
      setQuery('');
    } catch (error) {
      alert(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>Perplexity Ultra</h1>
          <p>Research-grade search with inline, clickable citations.</p>
        </div>
      </header>

      <main className="main">
        <div className="conversation-area">
          {conversations.length === 0 ? (
            <div className="welcome">
              <h2>Welcome to Perplexity Ultra</h2>
              <p>Ask anything and get a grounded answer with numbered source links.</p>
              <div className="features">
                <div className="feature">
                  <span>01</span>
                  <h3>Inline Citations</h3>
                  <p>Every supported claim can point back to a ranked source.</p>
                </div>
                <div className="feature">
                  <span>02</span>
                  <h3>Source Cards</h3>
                  <p>Review relevance, credibility, insight, and snippet side by side.</p>
                </div>
                <div className="feature">
                  <span>03</span>
                  <h3>Confidence Signal</h3>
                  <p>See how strongly the retrieved evidence supports the answer.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages">
              {conversations.map((msg, index) => (
                <div key={index} className={`message ${msg.type}`}>
                  <div className="message-header">
                    <span className="speaker">{msg.type === 'user' ? 'You' : 'Engine'}</span>
                    <span className="timestamp">{msg.timestamp?.toLocaleTimeString()}</span>
                  </div>
                  <div className="message-content">
                    {msg.type === 'assistant' ? <AssistantMessage msg={msg} /> : msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <footer className="footer">
          <div className="controls">
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="default">Standard Mode</option>
              <option value="research">Research Mode</option>
              <option value="verify">Verify Mode</option>
              <option value="explain">Explain Mode</option>
              <option value="quick">Quick Mode</option>
            </select>
            <select value={depth} onChange={(event) => setDepth(event.target.value)}>
              <option value="standard">Standard Depth</option>
              <option value="deep">Deep Analysis</option>
            </select>
            <button
              onClick={() => {
                setConversations([]);
                setCurrentConversationId(null);
              }}
              className="new-chat"
            >
              New Chat
            </button>
          </div>

          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Ask anything and inspect the evidence trail"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}

export default App;
