import { useI18n } from '../i18n-context.jsx';
import React, { useEffect, useRef } from 'react';
import { Package, Search, X } from 'lucide-react';

export function Badge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ title, children, icon: Icon = Package, action }) {
  return (
    <div className="empty-state">
      <Icon size={28} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SearchField({ value, onChange, label = 'Rechercher' }) {
  const { t } = useI18n();
  return (
    <label className="search-field">
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">{t(label)}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t(label)}
        type="search"
      />
    </label>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      // Keep keyboard focus inside the dialog's enabled, visible controls.
      const controls = [
        ...ref.current.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]'),
      ].filter((node) => !node.disabled && node.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t(title)}
        ref={ref}
        tabIndex={-1}
      >
        <header className="modal-heading">
          <div>
            <h2>{t(title)}</h2>
            {subtitle && <p>{t(subtitle)}</p>}
          </div>
          <button className="icon-button" aria-label={t('Fermer')} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
