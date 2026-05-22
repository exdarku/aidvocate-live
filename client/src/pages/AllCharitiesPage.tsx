import { useState, useMemo, useEffect } from 'react';
import { PageLayout, Container, SectionTitle, Loading, EmptyState } from '@/components/ui';
import CharityCard from '@/components/app/CharityCard';
import { useOrganizations } from '@/hooks';
import { categoryApi, type Category } from '@/services/api';
import magnifying from '@/assets/_Magnifyingglass.png';
import './listPage.css';

export default function AllCharitiesPage() {
  const { data: orgs, loading } = useOrganizations();
  const [cats, setCats] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('All');

  useEffect(() => {
    categoryApi.list().then(setCats).catch(() => setCats([]));
  }, []);

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = search.toLowerCase().trim();
    return orgs.filter((o) => {
      const matchSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q);
      const matchCat = selectedCat === 'All' || (o.categories ?? []).includes(selectedCat);
      return matchSearch && matchCat;
    });
  }, [orgs, search, selectedCat]);

  return (
    <PageLayout>
      <section className="list-page">
        <Container>
          <SectionTitle eyebrow="Get involved" title="Charities" />
          <p className="list-page__lead">Discover and support causes that matter to you.</p>

          <div className="filter-bar">
            <div className="search-input">
              <img src={magnifying} alt="" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search charities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search charities"
              />
            </div>
            <div className="chip-row" role="tablist" aria-label="Filter by category">
              <button
                role="tab"
                aria-selected={selectedCat === 'All'}
                className={`chip ${selectedCat === 'All' ? 'chip--active' : ''}`}
                onClick={() => setSelectedCat('All')}
              >
                All
              </button>
              {cats.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={selectedCat === c.name}
                  className={`chip ${selectedCat === c.name ? 'chip--active' : ''}`}
                  onClick={() => setSelectedCat(c.name)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No charities match your filters"
              description="Try clearing the search or selecting a different category."
            />
          ) : (
            <div className="card-grid card-grid--charities">
              {filtered.map((org) => (
                <CharityCard key={org.id} organization={org} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </PageLayout>
  );
}
