/**
 * DataPage — read-only data status for the active market.
 * Replaces the legacy DataOps page (AI-scan machinery is gone): the product
 * dataset is rebuilt by the local pipeline and shipped with each deploy, and
 * news is written monthly by the separately-deployed Cloud Function.
 */
import React, { useEffect, useState } from 'react';
import { getNews } from '../../services/dbService';
import { Language, HeatPump, NewsItem } from '../../types';
import { ACTIVE_COUNTRY } from '../../config/countryProfiles';
import { StatCard, SectionCard, PageHeader } from './shared';

interface DataPageProps {
  language: Language;
  /** Combined residential + commercial items loaded by the app shell. */
  products: HeatPump[] | null;
  lastUpdated?: string | null;
}

const maxDate = (items: HeatPump[], key: 'bafa_snapshot_fetched_at' | 'source_snapshot_generated_at'): string | null =>
  items.reduce<string | null>((acc, p) => {
    const v = p[key];
    return v && (!acc || v > acc) ? v : acc;
  }, null);

const fmt = (iso: string | null | undefined, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const DataPage: React.FC<DataPageProps> = ({ language, products, lastUpdated }) => {
  const de = language === 'de';
  const locale = de ? 'de-DE' : 'en-GB';
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => { getNews().then(setNews).catch(() => setNews([])); }, []);

  const items = products ?? [];
  const residential = items.filter(p => (p.power_35C_kw ?? p.power_55C_kw ?? 0) <= 20.99).length;
  const commercial = items.length - residential;
  const bafaSnapshot = maxDate(items, 'bafa_snapshot_fetched_at');
  const generatedAt = maxDate(items, 'source_snapshot_generated_at');
  const latestNews = news && news.length > 0
    ? news.map(n => n.date).sort().reverse()[0]
    : null;

  return (
    <div>
      <PageHeader
        title={de ? 'Daten' : 'Data'}
        subtitle={de
          ? `Datensatz-Status für den aktiven Markt (${ACTIVE_COUNTRY.name})`
          : `Dataset status for the active market (${ACTIVE_COUNTRY.name})`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={de ? 'Produkte gesamt' : 'Total products'} value={items.length.toLocaleString()} color="blue" icon="🗄️" />
        <StatCard label={de ? 'Wohngebäude' : 'Residential'} value={residential.toLocaleString()} color="green" icon="🏠" />
        <StatCard label={de ? 'Gewerbe' : 'Commercial'} value={commercial.toLocaleString()} color="yellow" icon="🏢" />
        <StatCard label={de ? 'Nachrichten' : 'News items'} value={news === null ? '…' : news.length} color="gray" icon="📰" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title={de ? 'Produktdatensatz' : 'Product dataset'} icon="🔧">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'Markt' : 'Market'}</span>
              <span className="font-medium">{ACTIVE_COUNTRY.name} ({ACTIVE_COUNTRY.code}) · {ACTIVE_COUNTRY.primaryRegistry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'BAFA-Quellstand' : 'Registry snapshot'}</span>
              <span className="font-medium">{fmt(bafaSnapshot, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'Datensatz erzeugt' : 'Dataset generated'}</span>
              <span className="font-medium">{fmt(generatedAt, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'In App geladen' : 'Loaded in app'}</span>
              <span className="font-medium">{fmt(lastUpdated, locale)}</span>
            </div>
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100 leading-relaxed">
              {de
                ? 'Der Produktdatensatz wird von der lokalen Pipeline (scripts/bafa) erzeugt und mit jedem Hosting-Deploy als statisches JSON ausgeliefert. Änderungen erscheinen hier nach Pipeline-Lauf + Deploy.'
                : 'The product dataset is produced by the local pipeline (scripts/bafa) and shipped as static JSON with each hosting deploy. Changes appear here after a pipeline run + deploy.'}
            </p>
          </div>
        </SectionCard>

        <SectionCard title={de ? 'News-Pipeline' : 'News pipeline'} icon="📰">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'Artikel gesamt' : 'Total articles'}</span>
              <span className="font-medium">{news === null ? '…' : news.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'Neuester Artikel' : 'Latest article'}</span>
              <span className="font-medium">{fmt(latestNews, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{de ? 'Quelle' : 'Source'}</span>
              <span className="font-medium">Cloud Function ({de ? 'monatlich' : 'monthly'})</span>
            </div>
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100 leading-relaxed">
              {de
                ? 'Marktnachrichten werden von der separat bereitgestellten Cloud Function erzeugt (google_cloud_function/, eigenes deploy.sh) und nach countries/' + ACTIVE_COUNTRY.code + ' geschrieben.'
                : 'Market news is generated by the separately deployed Cloud Function (google_cloud_function/, its own deploy.sh) and written to countries/' + ACTIVE_COUNTRY.code + '.'}
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
