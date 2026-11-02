import { useI18n } from '../i18n-context.jsx';
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  LoaderCircle,
  Search,
  TriangleAlert,
} from 'lucide-react';

async function readJSON(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'La bibliothèque ne répond pas.');
  return data;
}

/** The parent owns the surrounding modal and receives a normal project on import. */
export function SourceBrowser({ onImport }) {
  const { t, number } = useI18n();
  const [source, setSource] = useState('moviesum');
  const [split, setSplit] = useState('all');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [acknowledgeRights, setAcknowledgeRights] = useState(false);

  useEffect(() => {
    if (source !== 'moviesum') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setSelected(null);
    setAcknowledgeRights(false);
    const params = new URLSearchParams({ split, q: query, offset: String(offset) });
    fetch(`/api/library?${params}`, { signal: controller.signal })
      .then(readJSON)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCatalog(data);
        setSelected(data.items[0] || null);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setCatalog(null);
          setError(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [source, split, query, offset]);

  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    setPreviewLoading(false);
    if (source !== 'moviesum' || !selected) return;
    // Un aperçu déjà fourni peut être réutilisé. Sinon une seule ligne distante
    // est lue ; les titres du catalogue restent disponibles sans cette requête.
    if (selected.hasPreview !== false && typeof selected.preview === 'string') {
      setPreview(selected);
      return;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    const params = new URLSearchParams({
      split: selected.split,
      rowIndex: String(selected.rowIndex),
      expectedImdbId: selected.imdbId,
    });
    fetch(`/api/library/preview?${params}`, { signal: controller.signal })
      .then(readJSON)
      .then((data) => {
        if (!controller.signal.aborted) setPreview(data);
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setPreviewError(problem.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => controller.abort();
  }, [source, selected]);

  async function importSelected() {
    setImporting(true);
    setError('');
    try {
      const response =
        source === 'valkaama'
          ? await fetch('/api/samples/valkaama')
          : await fetch('/api/library/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'moviesum',
                split: selected.split,
                rowIndex: selected.rowIndex,
                expectedImdbId: selected.imdbId,
                acknowledgeRights,
              }),
            });
      const project = await readJSON(response);
      await onImport(project);
    } catch (error) {
      setError(error.message);
    } finally {
      setImporting(false);
    }
  }

  function search(event) {
    event.preventDefault();
    setOffset(0);
    setQuery(queryInput.trim());
  }

  function choose(item) {
    setSelected(item);
    setAcknowledgeRights(false);
  }

  // Une réponse lente concernant le film précédent ne doit jamais s'afficher
  // sous le titre du nouveau film sélectionné.
  const activePreview =
    preview?.split === selected?.split && preview?.rowIndex === selected?.rowIndex ? preview : null;

  return (
    <div className="source-browser">
      <div className="segmented source-tabs" role="group" aria-label={t('Source de scénarios')}>
        <button
          type="button"
          className={source === 'moviesum' ? 'selected' : ''}
          aria-pressed={source === 'moviesum'}
          onClick={() => {
            setSource('moviesum');
            setError('');
          }}
        >
          MovieSum <span>{t('2 200 films')}</span>
        </button>
        <button
          type="button"
          className={source === 'valkaama' ? 'selected' : ''}
          aria-pressed={source === 'valkaama'}
          onClick={() => {
            setSource('valkaama');
            setError('');
          }}
        >
          Valkaama <span>{t('Disponible hors ligne')}</span>
        </button>
      </div>

      {source === 'moviesum' ? (
        <>
          <p className="source-intro">
            {t(
              'Cherchez un titre ou un identifiant IMDb parmi les 2 200 films. Cet index est disponible hors ligne ; l’aperçu et l’import du scénario nécessitent une connexion.',
            )}
          </p>
          <form className="source-search" onSubmit={search}>
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label={t('Rechercher dans MovieSum')}
                placeholder={t('Titre du film ou identifiant IMDb…')}
                value={queryInput}
                maxLength={100}
                onChange={(event) => setQueryInput(event.target.value)}
              />
            </label>
            <button className="button secondary" type="submit" disabled={loading}>
              {t('Rechercher')}
            </button>
            <label className="source-collection">
              {t('Collection')}
              <select
                aria-label={t('Collection MovieSum')}
                value={split}
                onChange={(event) => {
                  setSplit(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">{t('Tous les films · 2 200')}</option>
                <option value="train">{t('Principale · 1 800 films')}</option>
                <option value="validation">{t('Validation · 200 films')}</option>
                <option value="test">{t('Test · 200 films')}</option>
              </select>
            </label>
          </form>
          {loading && (
            <p className="source-loading" role="status">
              <LoaderCircle size={18} className="spin" />
              {t('Chargement du catalogue…')}
            </p>
          )}
          {!loading && catalog && (
            <>
              <div className="source-results-line">
                <span>
                  {t(catalog.total > 1 ? '{count} résultats' : '{count} résultat', {
                    count: number(catalog.total),
                  })}
                  {query ? t(' pour « {query} »', { query }) : ''}
                </span>
                <a href={catalog.source.url} target="_blank" rel="noreferrer">
                  {t('Voir la source')} <ExternalLink size={14} />
                </a>
              </div>
              {catalog.items.length ? (
                <div className="source-layout">
                  <div className="source-list" role="group" aria-label={t('Films disponibles')}>
                    {catalog.items.map((item) => (
                      <button
                        type="button"
                        key={`${item.split}-${item.rowIndex}`}
                        className={`source-item ${selected?.split === item.split && selected?.rowIndex === item.rowIndex ? 'selected' : ''}`}
                        aria-pressed={
                          selected?.split === item.split && selected?.rowIndex === item.rowIndex
                        }
                        onClick={() => choose(item)}
                      >
                        <BookOpen size={18} />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.language}
                            {item.imdbId ? ` · ${item.imdbId}` : ''}
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                  {selected && (
                    <section className="source-preview" aria-label={t('Aperçu du scénario')}>
                      <div className="section-label">{t('APERÇU DU TEXTE')}</div>
                      <h3>{selected.title}</h3>
                      {previewLoading && (
                        <p className="source-loading" role="status">
                          <LoaderCircle size={17} className="spin" />
                          {t('Chargement de l’aperçu…')}
                        </p>
                      )}
                      {previewError && (
                        <p className="source-warning" role="status">
                          {t('Aperçu indisponible :')} {t(previewError)}
                        </p>
                      )}
                      {activePreview?.summary && (
                        <p className="source-summary">
                          {activePreview.summary}
                          {activePreview.summary.length >= 700 ? '…' : ''}
                        </p>
                      )}
                      {activePreview?.preview && (
                        <pre>
                          {activePreview.preview}
                          {activePreview.preview.length >= 650 ? '…' : ''}
                        </pre>
                      )}
                      <p className="source-size-note">
                        {t(
                          'Le début des textes longs est importé dans la limite de 60 séquences et 180 000 caractères. La portée exacte reste indiquée dans le projet. Les repères correspondent aux scènes XML, pas aux pages originales.',
                        )}
                      </p>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={acknowledgeRights}
                          onChange={(event) => setAcknowledgeRights(event.target.checked)}
                        />
                        <span>
                          {t('J’ai pris connaissance des conditions de réutilisation de MovieSum.')}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="button primary"
                        disabled={
                          importing || !acknowledgeRights || activePreview?.truncatedBySource
                        }
                        onClick={importSelected}
                      >
                        {importing ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <ArrowRight size={17} />
                        )}
                        {t('Importer ce scénario')}
                      </button>
                      {activePreview?.truncatedBySource && (
                        <p className="source-warning">
                          {t('Ce texte est tronqué par la source. Son import est indisponible.')}
                        </p>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <p className="source-empty">
                  {t(
                    'Aucun résultat dans cette collection. Essayez un autre mot ou une autre collection.',
                  )}
                </p>
              )}
              <div className="source-pagination">
                <button
                  type="button"
                  className="button secondary"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - catalog.pageSize))}
                >
                  <ArrowLeft size={16} />
                  {t('Précédent')}
                </button>
                <span>
                  {catalog.total
                    ? t('{start}–{end} sur {total}', {
                        start: number(offset + 1),
                        end: number(Math.min(offset + catalog.items.length, catalog.total)),
                        total: number(catalog.total),
                      })
                    : t('Aucun résultat')}
                </span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={offset + catalog.pageSize >= catalog.total || loading}
                  onClick={() => setOffset(offset + catalog.pageSize)}
                >
                  {t('Suivant')}
                  <ArrowRight size={16} />
                </button>
              </div>
              {catalog.partial && (
                <p className="source-warning">
                  {t(
                    'La source indique des résultats partiels. Le nombre de résultats peut évoluer.',
                  )}
                </p>
              )}
              <div className="source-rights">
                <TriangleAlert size={18} />
                <div>
                  <strong>{t('Conditions de réutilisation')}</strong>
                  <p>
                    {catalog.source.attribution}
                    {t('. Licence annoncée du jeu de données :')} {catalog.source.declaredLicense}.{' '}
                    {t(catalog.source.rightsNotice)}
                  </p>
                  <a href={catalog.source.paperUrl} target="_blank" rel="noreferrer">
                    {t('Publication des auteurs')} <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <section className="source-local">
          <div className="section-label">{t('SCÉNARIO PUBLIÉ PAR SON AUTEUR')}</div>
          <h3>Valkaama</h3>
          <p>
            {t(
              'Tim Baumann, d’après le roman de Hendrik Behnisch. Version anglaise du 30 juin 2007, 56 scènes. Le texte et les repères du PDF sont fournis avec le projet.',
            )}
          </p>
          <dl>
            <div>
              <dt>{t('Licence')}</dt>
              <dd>CC BY-SA 3.0</dd>
            </div>
            <div>
              <dt>{t('Analyse fournie')}</dt>
              <dd>{t('10 premières scènes · résultat enregistré')}</dd>
            </div>
            <div>
              <dt>{t('Attribution')}</dt>
              <dd>{t('Conservée dans le projet et ses exports')}</dd>
            </div>
          </dl>
          <p>
            {t(
              'Les adaptations de ce texte doivent conserver l’attribution et respecter le partage dans les mêmes conditions.',
            )}
          </p>
          <a
            href="https://www.valkaama.com/index.php?l=en&page=sources"
            target="_blank"
            rel="noreferrer"
          >
            {t('Page de l’auteur')} <ExternalLink size={14} />
          </a>
          <button
            type="button"
            className="button primary"
            disabled={importing}
            onClick={importSelected}
          >
            {importing ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}
            {t('Ouvrir Valkaama')}
          </button>
        </section>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <TriangleAlert size={18} />
          <span>{t(error)}</span>
        </div>
      )}
    </div>
  );
}

export default SourceBrowser;
