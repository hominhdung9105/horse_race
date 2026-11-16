import { ReactNode, useEffect } from 'react';

export default function ModalDialog({ title, description, onClose, children }: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-dialog-title">
      <div className="panel-title"><div><h2 id="modal-dialog-title">{title}</h2>{description && <p>{description}</p>}</div>
        <button type="button" className="icon-close ghost" onClick={onClose} aria-label={`Close ${title}`}>×</button>
      </div>
      {children}
    </section>
  </div>;
}
