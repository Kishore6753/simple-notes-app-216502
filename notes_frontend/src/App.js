import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function emptyDraft() {
  return { title: '', content: '' };
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [draft, setDraft] = useState(emptyDraft());
  const [isCreatingNew, setIsCreatingNew] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const selectedNote = useMemo(() => notes.find(n => n.id === selectedId) || null, [notes, selectedId]);

  async function requestJson(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });

    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        msg = data?.detail || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async function loadNotes() {
    setLoading(true);
    setError('');
    try {
      const data = await requestJson('/notes');
      setNotes(data);
      // Keep selection if possible; else reset to "new note"
      if (data.length === 0) {
        setSelectedId(null);
        setIsCreatingNew(true);
        setDraft(emptyDraft());
      } else if (selectedId && data.some(n => n.id === selectedId)) {
        // keep
      } else {
        setSelectedId(data[0].id);
        setIsCreatingNew(false);
        setDraft({ title: data[0].title, content: data[0].content });
      }
    } catch (e) {
      setError(e.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedNote) return;
    if (isCreatingNew) return;
    setDraft({ title: selectedNote.title, content: selectedNote.content });
  }, [selectedNote, isCreatingNew]);

  const hasChanges = useMemo(() => {
    if (isCreatingNew) {
      return draft.title.trim() !== '' || draft.content.trim() !== '';
    }
    if (!selectedNote) return false;
    return draft.title !== selectedNote.title || draft.content !== selectedNote.content;
  }, [draft, isCreatingNew, selectedNote]);

  function startNewNote() {
    setIsCreatingNew(true);
    setSelectedId(null);
    setDraft(emptyDraft());
    setError('');
  }

  function selectExisting(noteId) {
    const n = notes.find(x => x.id === noteId);
    if (!n) return;
    setIsCreatingNew(false);
    setSelectedId(noteId);
    setDraft({ title: n.title, content: n.content });
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: draft.title.trim() || 'Untitled',
        content: draft.content
      };

      if (isCreatingNew) {
        const created = await requestJson('/notes', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        await loadNotes();
        setSelectedId(created.id);
        setIsCreatingNew(false);
      } else if (selectedId != null) {
        await requestJson(`/notes/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        await loadNotes();
      }
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isCreatingNew || selectedId == null) {
      startNewNote();
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await requestJson(`/notes/${selectedId}`, { method: 'DELETE' });
      await loadNotes();
    } catch (e) {
      setError(e.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="notesApp">
      <aside className="sidebar" aria-label="Notes sidebar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">N</div>
          <div className="brandText">
            <div className="brandTitle">Notes</div>
            <div className="brandSubtitle">retro • simple • fast</div>
          </div>
        </div>

        <div className="sidebarActions">
          <button className="btn btnPrimary" onClick={startNewNote}>
            + New
          </button>
          <button className="btn btnGhost" onClick={loadNotes} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="sidebarList" role="list" aria-busy={loading ? 'true' : 'false'}>
          {loading && <div className="muted small pad">Loading…</div>}
          {!loading && notes.length === 0 && (
            <div className="muted small pad">No notes yet. Create your first one.</div>
          )}

          {notes.map(note => {
            const active = !isCreatingNew && selectedId === note.id;
            return (
              <button
                key={note.id}
                className={`noteRow ${active ? 'active' : ''}`}
                onClick={() => selectExisting(note.id)}
                role="listitem"
                aria-current={active ? 'true' : 'false'}
              >
                <div className="noteRowTitle">{note.title || 'Untitled'}</div>
                <div className="noteRowMeta">
                  Updated {formatTimestamp(note.updated_at)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="sidebarFooter">
          <div className="badge">
            API <span className="mono">{API_BASE_URL}</span>
          </div>
        </div>
      </aside>

      <main className="mainPanel" aria-label="Note editor">
        <div className="panelHeader">
          <div>
            <div className="panelTitle">{isCreatingNew ? 'New note' : 'Edit note'}</div>
            <div className="panelSubtitle">
              {isCreatingNew ? 'Draft (not saved yet)' : `ID ${selectedId}`}
              {!isCreatingNew && selectedNote && (
                <span className="panelTimes">
                  • Created {formatTimestamp(selectedNote.created_at)} • Updated {formatTimestamp(selectedNote.updated_at)}
                </span>
              )}
            </div>
          </div>

          <div className="panelButtons">
            <button className="btn btnPrimary" onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btnDanger" onClick={handleDelete} disabled={deleting || (isCreatingNew && !hasChanges)}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert" role="alert">
            <div className="alertTitle">Something went wrong</div>
            <div className="alertBody">{error}</div>
          </div>
        )}

        <div className="editor">
          <label className="field">
            <span className="label">Title</span>
            <input
              className="input"
              value={draft.title}
              onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Shopping list"
              maxLength={200}
            />
          </label>

          <label className="field">
            <span className="label">Content</span>
            <textarea
              className="textarea"
              value={draft.content}
              onChange={(e) => setDraft(d => ({ ...d, content: e.target.value }))}
              placeholder="Write something…"
              rows={14}
            />
          </label>

          <div className="hint">
            Tip: Keep it short, keep it fun. Your notes are saved in SQLite.
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
