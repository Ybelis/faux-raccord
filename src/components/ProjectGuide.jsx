import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { guideChapters } from '../../data/project-guide.js';
import { guideChaptersEn } from '../../data/project-guide.en.js';
import { useI18n } from '../i18n-context.jsx';

/** La documentation utilisateur partage une seule source de contenu. */
export function ProjectGuide({ chapterId, onChapter, onEvaluation }) {
  const { language, t } = useI18n();
  const chapters = language === 'en' ? guideChaptersEn : guideChapters;
  const chapter = chapters.find((item) => item.id === chapterId) || chapters[0];
  return (
    <div className="project-guide">
      <header className="page-heading">
        <div>
          <p className="page-index">{t('DOCUMENTATION')}</p>
          <h1>{chapter.title}</h1>
          <p className="page-description">{chapter.summary}</p>
        </div>
      </header>
      <div className="guide-layout">
        <nav className="guide-nav" aria-label={t('Rubriques de la documentation')}>
          {chapters.map((item) => (
            <a
              key={item.id}
              href={`#/docs/${item.id}`}
              aria-current={chapter.id === item.id ? 'page' : undefined}
              onClick={() => onChapter(item.id)}
            >
              <BookOpen size={16} />
              {item.title}
            </a>
          ))}
          <button className="text-button" onClick={onEvaluation}>
            {t('Consulter les résultats d’évaluation')} <ArrowRight size={15} />
          </button>
        </nav>
        <article className="guide-content">
          {chapter.sections.map((section) => (
            <section className="panel guide-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length > 0 && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.table && (
                <>
                  <p className="table-hint">
                    {t('Faites défiler le tableau pour lire toutes les colonnes.')}
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {section.table.columns.map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, index) => (
                          <tr key={index}>
                            {row.map((cell, i) =>
                              i === 0 ? (
                                <th scope="row" key={i}>
                                  {cell}
                                </th>
                              ) : (
                                <td key={i}>{cell}</td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {section.code && (
                <pre>
                  <code>{section.code}</code>
                </pre>
              )}
              {section.links?.length > 0 && (
                <ul className="guide-links">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                      >
                        {link.label}
                        <ArrowRight size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
