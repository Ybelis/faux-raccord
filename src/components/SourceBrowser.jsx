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
  const [source, setSource] = useState('moviesum');
  const [split, setSplit] = useState('train');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
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
                split,
                rowIndex: selected.rowIndex,
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

  return (
    <div className="source-browser">
      <div className="segmented source-tabs" role="group" aria-label="Source de scénarios">
        <button
          type="button"
          className={source === 'moviesum' ? 'selected' : ''}
          aria-pressed={source === 'moviesum'}
          onClick={() => {
            setSource('moviesum');
            setError('');
          }}
        >
          MovieSum <span>2 200 films</span>
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
          Valkaama <span>Disponible hors ligne</span>
        </button>
      </div>

      {source === 'moviesum' ? (
        <>
          <p className="source-intro">
            Cherchez un film ou un mot du scénario, consultez l’aperçu, puis importez le texte dans
            votre projet. La recherche couvre aussi le contenu des scénarios.
          </p>
          <form className="source-search" onSubmit={search}>
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Rechercher dans MovieSum"
                placeholder="Titre ou mot du scénario…"
                value={queryInput}
                maxLength={100}
                onChange={(event) => setQueryInput(event.target.value)}
              />
            </label>
            <button className="button secondary" type="submit" disabled={loading}>
              Rechercher
            </button>
            <label className="source-collection">
              Collection
              <select
                aria-label="Collection MovieSum"
                value={split}
                onChange={(event) => {
                  setSplit(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="train">Principale · 1 800 films</option>
                <option value="validation">Validation · 200 films</option>
                <option value="test">Test · 200 films</option>
              </select>
            </label>
          </form>
          {loading && (
            <p className="source-loading" role="status">
              <LoaderCircle size={18} className="spin" />
              Chargement du catalogue…
            </p>
          )}
          {!loading && catalog && (
            <>
              <div className="source-results-line">
                <span>
                  {catalog.total.toLocaleString('fr-FR')} résultat{catalog.total > 1 ? 's' : ''}
                  {query ? ` pour « ${query} »` : ''}
                </span>
                <a href={catalog.source.url} target="_blank" rel="noreferrer">
                  Voir la source <ExternalLink size={14} />
                </a>
              </div>
              {catalog.items.length ? (
                <div className="source-layout">
                  <div className="source-list" role="group" aria-label="Films disponibles">
                    {catalog.items.map((item) => (
                      <button
                        type="button"
                        key={`${item.split}-${item.rowIndex}`}
                        className={`source-item ${selected?.rowIndex === item.rowIndex ? 'selected' : ''}`}
                        aria-pressed={selected?.rowIndex === item.rowIndex}
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
                    <section className="source-preview" aria-label="Aperçu du scénario">
                      <div className="section-label">APERÇU DU TEXTE</div>
                      <h3>{selected.title}</h3>
                      {selected.summary && (
                        <p className="source-summary">
                          {selected.summary}
                          {selected.summary.length >= 700 ? '…' : ''}
                        </p>
                      )}
                      <pre>
                        {selected.preview}
                        {selected.preview.length >= 650 ? '…' : ''}
                      </pre>
                      <p className="source-size-note">
                        Le début des textes longs est importé dans la limite de 60 séquences et 180
                        000 caractères. La portée exacte reste indiquée dans le projet. Les repères
                        correspondent aux scènes XML, pas aux pages originales.
                      </p>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={acknowledgeRights}
                          onChange={(event) => setAcknowledgeRights(event.target.checked)}
                        />
                        <span>
                          J’ai pris connaissance des conditions de réutilisation de MovieSum.
                        </span>
                      </label>
                      <button
                        type="button"
                        className="button primary"
                        disabled={importing || !acknowledgeRights || selected.truncatedBySource}
                        onClick={importSelected}
                      >
                        {importing ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <ArrowRight size={17} />
                        )}
                        Importer ce scénario
                      </button>
                      {selected.truncatedBySource && (
                        <p className="source-warning">
                          Ce texte est tronqué par la source. Son import est indisponible.
                        </p>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <p className="source-empty">
                  Aucun résultat dans cette collection. Essayez un autre mot ou une autre
                  collection.
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
                  Précédent
                </button>
                <span>
                  {catalog.total
                    ? `${offset + 1}–${Math.min(offset + catalog.items.length, catalog.total)} sur ${catalog.total}`
                    : 'Aucun résultat'}
                </span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={offset + catalog.pageSize >= catalog.total || loading}
                  onClick={() => setOffset(offset + catalog.pageSize)}
                >
                  Suivant
                  <ArrowRight size={16} />
                </button>
              </div>
              {catalog.partial && (
                <p className="source-warning">
                  La source indique des résultats partiels. Le nombre de résultats peut évoluer.
                </p>
              )}
              <div className="source-rights">
                <TriangleAlert size={18} />
                <div>
                  <strong>Conditions de réutilisation</strong>
                  <p>
                    {catalog.source.attribution}. Licence annoncée du jeu de données :{' '}
                    {catalog.source.declaredLicense}. {catalog.source.rightsNotice}
                  </p>
                  <a href={catalog.source.paperUrl} target="_blank" rel="noreferrer">
                    Publication des auteurs <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <section className="source-local">
          <div className="section-label">SCÉNARIO PUBLIÉ PAR SON AUTEUR</div>
          <h3>Valkaama</h3>
          <p>
            Tim Baumann, d’après le roman de Hendrik Behnisch. Version anglaise du 30 juin 2007, 56
            scènes. Le texte et les repères du PDF sont fournis avec le projet.
          </p>
          <dl>
            <div>
              <dt>Licence</dt>
              <dd>CC BY-SA 3.0</dd>
            </div>
            <div>
              <dt>Analyse fournie</dt>
              <dd>10 premières scènes · résultat enregistré</dd>
            </div>
            <div>
              <dt>Attribution</dt>
              <dd>Conservée dans le projet et ses exports</dd>
            </div>
          </dl>
          <p>
            Les adaptations de ce texte doivent conserver l’attribution et respecter le partage dans
            les mêmes conditions.
          </p>
          <a
            href="https://www.valkaama.com/index.php?l=en&page=sources"
            target="_blank"
            rel="noreferrer"
          >
            Page de l’auteur <ExternalLink size={14} />
          </a>
          <button
            type="button"
            className="button primary"
            disabled={importing}
            onClick={importSelected}
          >
            {importing ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}
            Ouvrir Valkaama
          </button>
        </section>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <TriangleAlert size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default SourceBrowser;
