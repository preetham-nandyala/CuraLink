import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  Stethoscope, Send, LogOut, Plus, Trash2, X,
  PanelLeftClose, PanelLeftOpen, ExternalLink, Loader2,
  Sparkles, ChevronUp, FlaskConical, BookOpen, Lightbulb,
  FileText, Activity, TrendingUp, Heart, AlertTriangle,
  Compass, Star
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const MainApplication = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');

  const [showExtras, setShowExtras] = useState(false);
  const [diseaseInput, setDiseaseInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const [activeDetail, setActiveDetail] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isProcessing]);

  const fetchHistory = useCallback(async () => {
    if (!token) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try { const { data } = await axios.get(`${API}/conversations`, authHeaders); setConversations(data); }
    catch (e) { console.error(e); }
    setLoadingHistory(false);
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const loadConversation = async (id) => {
    try {
      const { data } = await axios.get(`${API}/conversations/${id}`, authHeaders);
      setConversationId(data._id);
      setActiveDetail(null);
      const parsed = (data.messages || []).map((m, i) => {
        if (m.role === 'assistant') {
          let content;
          try { content = typeof m.content === 'string' ? JSON.parse(m.content) : m.content; }
          catch { content = { condition_overview: m.content }; }
          return { role: 'assistant', content, sources: m.sources, metadata: m.metadata, id: i };
        }
        return { role: 'user', content: m.content, id: i };
      });
      setMessages(parsed);
    } catch (e) { console.error(e); }
  };

  const startNew = () => {
    setConversationId(null); setMessages([]); setActiveDetail(null);
    setInputVal(''); setDiseaseInput(''); setNameInput('');
    setShowExtras(false); inputRef.current?.focus();
  };

  const deleteConvo = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/conversations/${id}`, authHeaders);
      setConversations(prev => prev.filter(c => c._id !== id));
      if (conversationId === id) startNew();
    } catch (e) { console.error(e); }
  };

  const clearAll = async () => {
    try { await Promise.all(conversations.map(c => axios.delete(`${API}/conversations/${c._id}`, authHeaders))); setConversations([]); startNew(); }
    catch (e) { console.error(e); }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const q = inputVal.trim(), d = diseaseInput.trim();
    if (!q && !d) return;

    setMessages(prev => [...prev, { role: 'user', content: q || `Research ${d}`, id: Date.now() }]);
    setInputVal(''); setDiseaseInput(''); setNameInput('');
    setShowExtras(false); setIsProcessing(true); setStatus('Expanding query…'); setActiveDetail(null);

    const timers = [
      setTimeout(() => setStatus('Searching PubMed, OpenAlex & ClinicalTrials.gov…'), 1200),
      setTimeout(() => setStatus('Re-ranking with local embeddings…'), 3000),
      setTimeout(() => setStatus('Synthesizing with AI…'), 5000),
    ];

    try {
      const payload = { query: q, disease: d, patientName: nameInput.trim() || undefined };
      if (conversationId) payload.conversationId = conversationId;
      const { data } = await axios.post(`${API}/chat/structured`, payload, authHeaders);
      if (data.conversationId) setConversationId(data.conversationId);

      let parsed;
      try { parsed = JSON.parse(data.message.content); }
      catch { parsed = { condition_overview: data.message.content }; }

      setMessages(prev => [...prev, {
        role: 'assistant', content: parsed,
        sources: data.message.sources, metadata: data.message.metadata,
        id: Date.now() + 1,
      }]);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant', id: Date.now() + 1, isError: true,
        content: { condition_overview: 'Something went wrong. Please try again.' },
      }]);
    } finally {
      timers.forEach(clearTimeout); setIsProcessing(false); setStatus('');
    }
  };

  /* ── Section component ── */
  const Section = ({ icon: Icon, iconColor, label, children }) => (
    <div className="mb-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
        <Icon size={13} className={iconColor} /> {label}
      </h3>
      {children}
    </div>
  );

  /* ── Render message ── */
  const renderMessage = (msg) => {
    if (msg.role === 'user') {
      return (
        <div className="flex justify-end mb-5" key={msg.id}>
          <div className="bg-primary text-on-primary px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[75%] text-sm shadow">
            {msg.content}
          </div>
        </div>
      );
    }

    const d = msg.content || {};

    return (
      <div className="mb-10 animate-fade-in" key={msg.id}>
        {/* avatar + overview */}
        <div className="flex gap-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-none mt-0.5">
            <Sparkles size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <Section icon={Stethoscope} iconColor="text-primary" label="Condition Overview">
              <div className="text-sm text-on-surface-variant leading-relaxed markdown-body">
                <ReactMarkdown>{d.condition_overview || ''}</ReactMarkdown>
              </div>
            </Section>
          </div>
        </div>

        <div className="ml-11">
          {/* Research Insights */}
          {d.research_insights?.length > 0 && (
            <Section icon={Lightbulb} iconColor="text-tertiary" label="Research Insights">
              <ul className="space-y-1.5">
                {d.research_insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary flex-none mt-2" />
                    {insight}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Key Takeaway */}
          {d.key_takeaway && (
            <Section icon={Compass} iconColor="text-primary" label="Key Takeaway">
              <div className="bg-primary/[0.06] border border-primary/20 rounded-xl p-4">
                <p className="text-sm font-medium text-on-surface leading-relaxed">{d.key_takeaway}</p>
              </div>
            </Section>
          )}

          {/* Key Publications - Native Pipeline Feed */}
          {msg.sources?.filter(s => s.type === 'publication').length > 0 && (
            <Section icon={BookOpen} iconColor="text-primary" label="Key Publications">
              <div className="space-y-2">
                {msg.sources.filter(s => s.type === 'publication').map((pub, idx) => (
                  <div key={idx}
                    onClick={() => setActiveDetail({ ...pub, type: 'publication' })}
                    className="bg-surface border border-outline-variant/20 rounded-xl p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-2 mb-1">
                      <div className="flex items-start gap-2">
                        <span className="flex-none w-6 h-5 rounded bg-primary text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{idx + 1}</span>
                        <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">{pub.title} ({pub.year || 'N/A'})</h4>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant ml-8 line-clamp-2 mt-1">{pub.snippet || pub.abstract || 'No abstract available.'}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Clinical Trials - Native Pipeline Feed */}
          {msg.sources?.filter(s => s.type === 'clinical_trial').length > 0 && (
            <Section icon={FlaskConical} iconColor="text-secondary" label="Clinical Trials">
              <div className="space-y-2">
                {msg.sources.filter(s => s.type === 'clinical_trial').map((trial, idx) => (
                  <div key={idx}
                    onClick={() => setActiveDetail({ ...trial, type: 'trial' })}
                    className="bg-surface border border-outline-variant/20 rounded-xl p-3 cursor-pointer hover:border-secondary/40 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex-none w-6 h-5 rounded bg-secondary text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-none ${trial.status?.toLowerCase().includes('recruiting') && !trial.status?.toLowerCase().includes('not') ? 'bg-secondary-container/40 text-secondary' : trial.status?.toLowerCase().includes('completed') ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                        {trial.status || 'Unknown Status'}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold group-hover:text-secondary transition-colors ml-8">{trial.title}</h4>
                    <p className="text-xs text-on-surface-variant ml-8 line-clamp-2 mt-1">{trial.abstract || trial.eligibility || 'Details inside.'}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Source Transparency disabled for cleaner production UI */}
        </div>
      </div>
    );
  };

  /* ═══════════════════════ LAYOUT ═══════════════════════ */
  return (
    <div className="flex h-screen bg-background overflow-hidden font-body">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}
      
      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-0'} fixed md:relative z-30 flex-none h-full flex flex-col bg-surface border-r-2 border-outline-variant/40 shadow-2xl md:shadow-[8px_0_40px_rgba(0,0,0,0.08)] bg-opacity-95 transition-all duration-300 overflow-hidden`}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-outline-variant/15 flex-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Stethoscope size={14} className="text-white" />
            </div>
            <span className="font-headline font-bold text-sm">CuraLink</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-surface-container text-outline">
            <PanelLeftClose size={15} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 flex-none">
          <button onClick={startNew} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/30 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors">
            <Plus size={15} /> New Research
          </button>
        </div>

        {user && (
          <div className="px-4 pt-2 pb-1 flex items-center justify-between flex-none">
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">History</span>
            {conversations.length > 0 && (
              <button onClick={clearAll} className="text-[10px] text-outline hover:text-error transition-colors">Clear all</button>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-px mt-1">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <span className="text-xs text-outline leading-relaxed">Sign in or create an account to save your chat history and unlock all features.</span>
            </div>
          ) : loadingHistory ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-outline" size={16} /></div>
          ) : conversations.length === 0 ? (
            <div className="text-xs text-outline text-center mt-4">No history yet.</div>
          ) : conversations.map(c => (
            <button key={c._id} onClick={() => loadConversation(c._id)}
              className={`w-full group flex items-center gap-1 px-3 py-1.5 rounded-md text-left text-[13px] transition-colors ${conversationId === c._id ? 'bg-surface-container font-medium text-on-surface' : 'text-on-surface-variant hover:bg-surface-container/60'}`}>
              <span className="flex-1 truncate">{c.title || c.userProfile?.diseaseOfInterest || c.context?.diseases?.[0] || 'Untitled'}</span>
              <span onClick={(e) => deleteConvo(c._id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-error transition-all flex-none">
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-2.5 border-t border-outline-variant/15 flex items-center justify-between flex-none">
          {user ? (
            <>
              <span className="text-xs font-medium text-on-surface truncate">{user.name}</span>
              <button onClick={() => { logout(); navigate('/'); }} className="text-xs font-medium text-primary hover:text-error transition-colors">Logout</button>
            </>
          ) : (
            <div className="w-full flex justify-between gap-2">
              <button onClick={() => navigate('/login')} className="flex-1 text-center py-1.5 rounded-md text-xs font-medium bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors">Log in</button>
              <button onClick={() => navigate('/register')} className="flex-1 text-center py-1.5 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary-hover transition-colors">Sign up</button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {!sidebarOpen && (
          <div className="absolute top-2 left-2 z-20">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg bg-surface shadow-sm border border-outline-variant/20 text-outline hover:text-on-surface transition-colors">
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6 w-full">
            {messages.length === 0 ? (
              <div className="h-full min-h-[65vh] flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <Stethoscope size={24} />
                </div>
                <h2 className="font-headline font-bold text-lg mb-1">Hi, {user?.name?.split(' ')[0] || 'Researcher'}</h2>
                <p className="text-sm text-on-surface-variant max-w-sm">Ask about any disease, treatment, or research question.</p>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}
                {isProcessing && (
                  <div className="flex items-center gap-3 text-on-surface-variant text-sm px-4 py-3 rounded-xl bg-surface-container/50 animate-fade-in mb-4">
                    <Loader2 className="animate-spin text-primary" size={16} /><span>{status}</span>
                  </div>
                )}
                <div ref={endRef} />
              </>
            )}
          </div>
        </div>

        {showExtras && (
          <div className="flex-none px-4 mx-auto w-full animate-fade-in relative z-10">
            <div className="max-w-3xl mx-auto flex flex-col gap-3 mb-2 p-4 bg-surface border border-outline-variant/40 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] relative">
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Patient Context</span>
                <button type="button" onClick={() => setShowExtras(false)} className="p-1 rounded-lg hover:bg-surface-container text-outline"><ChevronUp size={16} /></button>
              </div>
              <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Patient (optional)" disabled={isProcessing} className="input-field text-sm w-full" />
              <input type="text" value={diseaseInput} onChange={e => setDiseaseInput(e.target.value)} placeholder="Condition" disabled={isProcessing} className="input-field text-sm w-full" />
            </div>
          </div>
        )}

        <div className="flex-none px-2 md:px-4 pb-4 pt-1 w-full relative z-10">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-2 bg-surface rounded-2xl px-2 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] border border-outline-variant/40 focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all duration-300 translate-y-0 relative z-20">
            <button type="button" onClick={() => setShowExtras(!showExtras)} className="flex-none p-2 rounded-md hover:bg-surface-container text-outline transition-colors"><Plus size={18} /></button>
            <input type="text" ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Ask about disease, treatment..." disabled={isProcessing} className="flex-1 bg-transparent text-sm md:text-base outline-none border-none shadow-none ring-0 focus:ring-0 focus:outline-none placeholder:text-outline-variant py-2 w-full min-w-0" />
            <button type="submit" disabled={isProcessing || (!inputVal && !diseaseInput)} className="flex-none w-10 h-10 md:w-9 md:h-9 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-30 hover:bg-primary-hover transition-colors"><Send size={16} /></button>
          </form>
          <p className="text-center text-[10px] text-outline mt-1.5 pb-1">CuraLink is an AI research assistant. All insights must be independently verified. Not for direct diagnostic use.</p>
        </div>
      </main>

      {/* RIGHT DETAIL PANEL */}
      {activeDetail && (
        <>
          <div className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-30" onClick={() => setActiveDetail(null)} />
          <div className="fixed right-0 top-0 h-full w-[560px] max-w-[90vw] bg-surface shadow-2xl z-40 flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 h-12 border-b border-outline-variant/15 flex-none">
              <div className="flex items-center gap-2">
                {activeDetail.type === 'publication' ? <FileText size={16} className="text-primary" /> : <FlaskConical size={16} className="text-secondary" />}
                <span className="font-headline font-bold text-sm">{activeDetail.type === 'publication' ? 'Publication' : 'Clinical Trial'}</span>
              </div>
              <button onClick={() => setActiveDetail(null)} className="p-1.5 rounded-lg hover:bg-surface-container text-outline transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <h2 className="text-xl font-bold font-headline leading-snug mb-4">{activeDetail.title}</h2>

              {activeDetail.type === 'publication' && (
                <div className="space-y-2 mb-6">
                  {activeDetail.authors && <div className="flex gap-3 text-sm"><span className="text-outline font-medium w-16 flex-none">Authors</span><span className="text-on-surface-variant">{activeDetail.authors}</span></div>}
                  {activeDetail.year && <div className="flex gap-3 text-sm"><span className="text-outline font-medium w-16 flex-none">Year</span><span className="text-on-surface-variant">{activeDetail.year}</span></div>}
                  {activeDetail.source && (
                    <div className="flex gap-3 text-sm items-center"><span className="text-outline font-medium w-16 flex-none">Source</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${activeDetail.source === 'PubMed' ? 'bg-primary text-white' : 'bg-tertiary text-white'}`}>{activeDetail.source}</span>
                    </div>
                  )}
                </div>
              )}

              {activeDetail.type === 'trial' && (
                <div className="space-y-2 mb-6">
                  <div className="flex gap-3 text-sm items-center"><span className="text-outline font-medium w-16 flex-none">Status</span>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded ${activeDetail.status?.toLowerCase().includes('recruiting') ? 'bg-secondary-container/40 text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>{activeDetail.status}</span>
                  </div>
                  {activeDetail.eligibility && <div className="flex gap-3 text-sm"><span className="text-outline font-medium w-16 flex-none">Eligible</span><span className="text-on-surface-variant">{activeDetail.eligibility}</span></div>}
                </div>
              )}

              {(activeDetail.abstract || activeDetail.details) && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">{activeDetail.type === 'publication' ? 'Abstract' : 'Trial Details'}</h3>
                  <div className="text-sm text-on-surface-variant leading-relaxed bg-surface-container/30 p-4 rounded-xl border border-outline-variant/10 whitespace-pre-wrap">{activeDetail.abstract || activeDetail.details}</div>
                </div>
              )}

              {(activeDetail.key_finding || activeDetail.why_it_matters) && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5"><Sparkles size={12} /> AI Key Findings</h3>
                  <div className="text-sm text-on-surface-variant leading-relaxed border-l-2 border-primary/30 pl-4 bg-primary/[0.03] py-3 pr-3 rounded-r-xl space-y-1">
                    {activeDetail.key_finding && <p>{activeDetail.key_finding}</p>}
                    {activeDetail.why_it_matters && <p className="italic text-primary/80">{activeDetail.why_it_matters}</p>}
                  </div>
                </div>
              )}

              {activeDetail.url && (
                <a href={activeDetail.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm">
                  <ExternalLink size={15} /> Open original paper
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MainApplication;
