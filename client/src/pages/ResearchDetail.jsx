import React from 'react';
import './ResearchDetail.css';

export default function ResearchDetail({ article, onClose }) {
  if (!article) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <span className="material-icons" style={{ fontSize: 20 }}>close</span>
              </button>
              <span className="text-xs font-mono font-bold text-primary-blue" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                 {article.id || "PUB-1029X"}
              </span>
           </div>
           <div style={{ display: 'flex', gap: '0.4rem' }}>
              <a href={article.url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                 <span className="material-icons" style={{ fontSize: 14 }}>download</span> Full Text
              </a>
           </div>
        </div>

        {/* Split Layout */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
           
           {/* Left: Source Data */}
           <div style={{ flex: 3, padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ maxWidth: 600 }}>
                 <span className="badge" style={{ backgroundColor: 'var(--highlight-bg)', color: 'var(--color-blue)', marginBottom: '1rem', textTransform: 'uppercase', display: 'inline-block' }}>
                   {article.platform || "Peer Reviewed"}
                 </span>
                 <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.75rem', lineHeight: 1.3 }}>
                   {article.title}
                 </h2>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
                    <span className="font-medium text-primary-blue" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                       {article.authors?.join(', ') || "Unknown Authors"}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{article.year}</span>
                 </div>
                 
                 <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0', marginBottom: '1.25rem', display: 'flex', gap: '2rem', fontSize: '0.75rem' }}>
                    <div>
                       <p className="text-xs font-bold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Source</p>
                       <p className="font-bold" style={{ fontSize: '0.8rem' }}>{article.platform || 'Clinical Registry'}</p>
                    </div>
                    {article.url && (
                    <div style={{ minWidth: 0, flex: 1 }}>
                       <p className="text-xs font-bold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>URL</p>
                       <p className="text-xs font-mono text-primary-blue" style={{ wordBreak: 'break-all' }}>{article.url}</p>
                    </div>
                    )}
                 </div>

                 <section>
                    <h3 className="text-xs font-bold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Abstract</h3>
                    <p className="text-sm" style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                       {article.snippet || "Full abstract not provided. Click 'Full Text' to view the original source."}
                    </p>
                 </section>
              </div>
           </div>

           {/* Right: AI Overlay */}
           <div style={{ flex: 2, backgroundColor: 'var(--bg-primary)', borderLeft: '1px solid var(--border-color)', overflowY: 'auto' }}>
              <div style={{ padding: '1.25rem' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ width: 28, height: 28, backgroundColor: 'var(--color-blue)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span className="material-icons" style={{ color: '#FFF', fontSize: 14 }}>auto_awesome</span>
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-blue)' }}>CuraLink AI Summary</h3>
                 </div>

                 <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid var(--color-blue)', backgroundColor: 'var(--highlight-bg)', padding: '0.75rem' }}>
                    <p className="text-xs font-bold text-primary-blue" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Core Takeaway</p>
                    <p className="text-sm font-medium" style={{ lineHeight: 1.6 }}>
                       This study provides evidence supporting the queried context. Results indicate correlation between the variables explored.
                    </p>
                 </div>

                 <div style={{ marginBottom: '1.5rem' }}>
                    <h4 className="text-xs font-bold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                       <span className="material-icons" style={{ color: 'var(--badge-warning)', fontSize: 14 }}>warning</span>
                       Limitations
                    </h4>
                    <ul style={{ paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                       <li className="text-xs" style={{ marginBottom: '0.3rem' }}>Snippet data may lack full methodological depth.</li>
                       <li className="text-xs" style={{ marginBottom: '0.3rem' }}>AI evaluation is based on abstracts, not full-text peer review.</li>
                    </ul>
                 </div>

                 <div style={{ padding: '0.6rem', backgroundColor: 'var(--bg-card)', borderRadius: 6, border: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Accurate summary?</p>
                    <div style={{ display: 'flex', gap: '0.15rem' }}>
                       <button style={{ padding: 3, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}><span className="material-icons" style={{ fontSize: 14 }}>thumb_up</span></button>
                       <button style={{ padding: 3, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}><span className="material-icons" style={{ fontSize: 14 }}>thumb_down</span></button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
