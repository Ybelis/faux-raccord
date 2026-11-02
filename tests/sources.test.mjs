import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleSources, movieSumProject, MOVIESUM } from '../worker/sources.js';
import sourceIndex from '../data/moviesum-index.json' with { type: 'json' };

const xml =
  '<script><scene><stage_direction>INT. ATELIER - DAY</stage_direction><character>CLARA</character><dialogue>La montre &quot;argentée&quot; est intacte &amp; propre.</dialogue></scene><scene><stage_direction>EXT. COUR - NIGHT</stage_direction><scene_description>La montre de Clara est brisée sur les pavés.</scene_description></scene></script>';
const entry = (index = 0, script = xml) => ({
  row_idx: index,
  row: {
    movie_name: 'Test_2024',
    imdb_id: 'tt1234567',
    script,
    summary: 'Une histoire de montre.',
  },
  truncated_cells: [],
});
const response = (rows) =>
  new Response(JSON.stringify({ rows, num_rows_total: 1800, partial: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
const request = (path, body) =>
  new Request(
    `http://localhost${path}`,
    body
      ? {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }
      : undefined,
  );
const indexedEntry = (split, rowIndex) => {
  const index = sourceIndex.items.find(
    (item) => item.split === split && item.rowIndex === rowIndex,
  );
  const item = entry(rowIndex);
  return { ...item, row: { ...item.row, imdb_id: index.imdbId } };
};

test('MovieSum preserves XML scene references, attribution and honest page provenance', () => {
  const project = movieSumProject(entry(12), 'train', new Date('2026-11-02T12:00:00Z'));
  assert.match(project.id, /^moviesum-[a-f0-9-]{36}$/);
  assert.equal(project.title, 'Test (2024)');
  assert.equal(project.scenes.length, 2);
  assert.equal(project.scenes[0].id, 'S001');
  assert.match(project.scenes[0].text, /"argentée" est intacte & propre/);
  assert.equal(project.scenes[1].sourceSceneNumber, 2);
  assert.equal(project.scenes[0].pageIsSceneReference, true);
  assert.equal(project.pageCount, 0);
  assert.equal(project.provenance.locator, 'xml-scene');
  assert.equal(project.provenance.excerpt, false);
  assert.equal(project.provenance.importedAt, '2026-11-02T12:00:00.000Z');
  assert.match(project.provenance.rightsNotice, /ne garantit pas les droits/);
  assert.match(project.provenance.attribution, /Saxena/);
  assert.equal(project.synthetic, false);
  assert.equal(project.analysis, null);
  assert.notEqual(movieSumProject(entry(12), 'train').id, project.id);
});

test('long MovieSum imports are bounded and explicitly marked as excerpts', () => {
  const longXML =
    '<script>' +
    Array.from(
      { length: 75 },
      (_, index) =>
        `<scene><stage_direction>INT. PIÈCE ${index} - DAY</stage_direction><scene_description>${'Une montre est posée sur la table. '.repeat(200)}</scene_description></scene>`,
    ).join('') +
    '</script>';
  const project = movieSumProject(entry(0, longXML), 'train');
  assert.ok(project.scenes.length <= 60);
  assert.ok(project.characterCount <= 180_000);
  assert.ok(project.scenes.every((scene) => scene.text.length <= 13_500));
  assert.equal(project.provenance.originalSceneCount, 75);
  assert.equal(project.provenance.excerpt, true);
  assert.ok(project.warnings.some((warning) => warning.startsWith('Extrait importé')));
});

test('exceptionally long scenes are split with their original source number', () => {
  const longXML = `<script><scene><stage_direction>INT. PIÈCE - DAY</stage_direction><scene_description>${'Une montre est sur la table.\n'.repeat(1000)}</scene_description></scene></script>`;
  const project = movieSumProject(entry(0, longXML), 'train');
  assert.ok(project.scenes.length > 1);
  assert.ok(
    project.scenes.every((scene) => scene.sourceSceneNumber === 1 && scene.text.length <= 13_500),
  );
  assert.equal(project.scenes[0].number, '1.1');
  assert.match(project.warnings.join(' '), /divisées en parties/);
});

test('malformed and source-truncated screenplays are rejected', () => {
  assert.throws(
    () => movieSumProject({ ...entry(), truncated_cells: ['script'] }, 'train'),
    /tronqué/,
  );
  assert.throws(
    () => movieSumProject(entry(0, '<!DOCTYPE script><script>' + xml + '</script>'), 'train'),
    /Structure XML/,
  );
  assert.throws(
    () =>
      movieSumProject(
        entry(0, 'Texte sans balises de scène mais assez long pour être un document.'),
        'train',
      ),
    /Aucune scène XML/,
  );
});

test('title and IMDb search uses the real metadata index without a remote search service', async () => {
  let requests = 0;
  const result = await handleSources(
    request('/api/library?split=all&q=Napol%C3%A9on%202023'),
    {},
    {
      fetcher: async () => {
        requests++;
        throw new Error('The title index is offline.');
      },
    },
  );
  const data = await result.json();
  assert.equal(result.status, 200);
  assert.equal(requests, 0);
  assert.equal(data.source.id, MOVIESUM.id);
  assert.equal(data.total, 1);
  assert.equal(data.items[0].title, 'Napoleon (2023)');
  assert.equal(data.items[0].rowIndex, 3);
  assert.equal(data.items[0].split, 'train');
  assert.equal(data.catalogMode, 'local-metadata-index');
  assert.equal(data.items[0].script, undefined);
  assert.equal(data.items[0].preview, '');
  const imdbResult = await handleSources(request('/api/library?split=all&q=tt13287846'));
  assert.equal((await imdbResult.json()).items[0].title, 'Napoleon (2023)');
});

test('all 2200 source metadata rows have unique locators, integrity and no screenplay text', async () => {
  assert.equal(sourceIndex.count, 2200);
  assert.equal(sourceIndex.items.length, 2200);
  assert.equal(
    new Set(sourceIndex.items.map((item) => `${item.split}:${item.rowIndex}`)).size,
    2200,
  );
  assert.equal(
    createHash('sha256').update(JSON.stringify(sourceIndex.items)).digest('hex'),
    sourceIndex.itemsSha256,
  );
  assert.ok(
    sourceIndex.items.every(
      (item) => Object.keys(item).sort().join(',') === 'imdbId,rowIndex,split,title',
    ),
  );
  const first = await (await handleSources(request('/api/library?split=all'))).json();
  const second = await (await handleSources(request('/api/library?split=all&offset=6'))).json();
  assert.equal(first.total, 2200);
  assert.equal(first.items.length, 6);
  assert.equal(second.items[0].rowIndex, 6);
  assert.notEqual(first.items[0].imdbId, second.items[0].imdbId);
});

test('a selected preview reads one bounded row from the known dataset', async () => {
  let remote;
  const result = await handleSources(
    request('/api/library/preview?split=train&rowIndex=9'),
    {},
    {
      fetcher: async (url, options) => {
        remote = { url, options };
        return response([indexedEntry('train', 9)]);
      },
    },
  );
  const item = await result.json();
  assert.equal(result.status, 200);
  assert.equal(remote.url.origin, 'https://datasets-server.huggingface.co');
  assert.equal(remote.url.pathname, '/rows');
  assert.equal(remote.url.searchParams.get('length'), '1');
  assert.equal(remote.options.redirect, 'error');
  assert.equal(item.script, undefined);
  assert.ok(item.preview.length <= 650);
  assert.ok(item.summary.length <= 700);
});

test('a changed remote row cannot silently import another film from a stale index', async () => {
  const result = await handleSources(
    request('/api/library/import', {
      source: 'moviesum',
      split: 'train',
      rowIndex: 0,
      acknowledgeRights: true,
    }),
    {},
    { fetcher: async () => response([entry(0)]) },
  );
  assert.equal(result.status, 409);
  assert.match((await result.json()).error, /catalogue source a changé/);
});

test('library imports only an explicit known row and records its origin', async () => {
  let remote;
  const result = await handleSources(
    request('/api/library/import', {
      source: 'moviesum',
      split: 'test',
      rowIndex: 15,
      acknowledgeRights: true,
    }),
    {},
    {
      fetcher: async (url) => {
        remote = url;
        return response([indexedEntry('test', 15)]);
      },
    },
  );
  const project = await result.json();
  assert.equal(result.status, 200);
  assert.equal(remote.pathname, '/rows');
  assert.equal(remote.searchParams.get('length'), '1');
  assert.equal(remote.searchParams.get('offset'), '15');
  assert.equal(project.provenance.split, 'test');
  assert.equal(project.provenance.rowIndex, 15);
  assert.match(project.provenance.sourceSha256, /^[a-f0-9]{64}$/);
});

test('invalid source selections, arbitrary URLs and missing acknowledgment never reach the network', async () => {
  let requests = 0;
  const options = {
    fetcher: async () => {
      requests++;
      throw new Error('Network must not be used.');
    },
  };
  for (const input of [
    request('/api/library?dataset=another/dataset'),
    request('/api/library?url=http://127.0.0.1'),
    request('/api/library?split=unknown'),
    request('/api/library?offset=-1'),
    request('/api/library?offset=9999'),
    request('/api/library?q=' + 'x'.repeat(101)),
    request('/api/library/import', {
      source: 'https://example.org',
      rowIndex: 0,
      acknowledgeRights: true,
    }),
    request('/api/library/import', { source: 'moviesum', rowIndex: 0, acknowledgeRights: false }),
    request('/api/library/import', { source: 'moviesum', rowIndex: 2000, acknowledgeRights: true }),
    request('/api/library/import', { source: 'moviesum', rowIndex: null, acknowledgeRights: true }),
    request('/api/library/import', { source: 'moviesum', rowIndex: true, acknowledgeRights: true }),
    request('/api/library/import', {
      source: 'moviesum',
      rowIndex: 0,
      url: 'http://127.0.0.1',
      acknowledgeRights: true,
    }),
  ]) {
    const result = await handleSources(input, {}, options);
    assert.equal(result.status, 400);
  }
  assert.equal(requests, 0);
});

test('oversized import requests are rejected without reaching the dataset', async () => {
  const result = await handleSources(
    request('/api/library/import', {
      source: 'moviesum',
      extra: 'x'.repeat(3000),
      acknowledgeRights: true,
    }),
    {},
    {
      fetcher: () => {
        throw new Error('must not call');
      },
    },
  );
  assert.equal(result.status, 413);
});

test('cross-origin import is rejected before any remote request', async () => {
  const input = new Request('http://localhost/api/library/import', {
    method: 'POST',
    headers: { Origin: 'https://other.example' },
    body: '{}',
  });
  const result = await handleSources(
    input,
    {},
    {
      fetcher: () => {
        throw new Error('must not call');
      },
    },
  );
  assert.equal(result.status, 403);
});

test('large or invalid upstream responses fail safely and other API routes pass through', async () => {
  assert.equal(await handleSources(request('/api/status')), null);
  const oversized = await handleSources(
    request('/api/library/preview?split=train&rowIndex=2'),
    {},
    {
      fetcher: async () =>
        new Response('{}', { headers: { 'content-length': String(9 * 1024 * 1024) } }),
    },
  );
  assert.equal(oversized.status, 502);
  const malformed = await handleSources(
    request('/api/library/preview?split=train&rowIndex=3'),
    {},
    { fetcher: async () => new Response('not JSON') },
  );
  assert.equal(malformed.status, 502);
  const unavailable = await handleSources(
    request('/api/library/preview?split=train&rowIndex=4'),
    {},
    { fetcher: async () => new Response('{}', { status: 429 }) },
  );
  assert.equal(unavailable.status, 502);
  assert.match((await unavailable.json()).error, /limite les requêtes/);
});
