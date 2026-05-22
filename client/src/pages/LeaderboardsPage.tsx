import { useNavigate } from '@tanstack/react-router';
import { PageLayout, Container, SectionTitle, Button, Loading, EmptyState, CrownIcon } from '@/components/ui';
import { useResource } from '@/hooks';
import { leaderboardApi, type LeaderboardEntry } from '@/services/api';
import './leaderboardsPage.css';

function initials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name[0].toUpperCase();
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PodiumProps {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
}

function Podium({ entry, place }: PodiumProps) {
  const placeName = place === 1 ? 'first' : place === 2 ? 'second' : 'third';
  return (
    <div className={`podium-item podium-item--${placeName}`}>
      {place === 1 && <div className="podium-crown" aria-label="First place"><CrownIcon /></div>}
      <div className={`podium-base podium-base--${placeName}`}>
        <div className="podium-avatar-wrap">
          <div className={`podium-avatar ${place === 1 ? 'podium-avatar--winner' : ''}`}>
            {initials(entry.name)}
          </div>
        </div>
        <div className="podium-info">
          <h3>{entry.name}</h3>
          <p className="podium-score">{formatPHP(entry.totalDonated)}</p>
          <p className="podium-username">@{entry.username || 'donor'}</p>
        </div>
        <span className="podium-position">{place}</span>
      </div>
    </div>
  );
}

export default function LeaderboardsPage() {
  const navigate = useNavigate();
  const { data, loading } = useResource(() => leaderboardApi.list(), []);

  const list = data ?? [];
  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <PageLayout>
      <section className="leaderboard-page">
        <Container>
          <SectionTitle
            eyebrow="Ranked by support, driven by purpose"
            title="Meet the top change makers"
          />

          {loading ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState
              title="No donations recorded yet"
              description="Be the first to make a difference."
              action={
                <Button variant="primary" onClick={() => navigate({ to: '/charities' })}>
                  Donate now
                </Button>
              }
            />
          ) : (
            <>
              <div className="podium-wrap">
                <div className="podium">
                  {top3[1] && <Podium entry={top3[1]} place={2} />}
                  {top3[0] && <Podium entry={top3[0]} place={1} />}
                  {top3[2] && <Podium entry={top3[2]} place={3} />}
                </div>
              </div>

              {rest.length > 0 && (
                <ul className="ranking-list">
                  {rest.map((u) => (
                    <li key={u.userId} className="rank-row">
                      <div className="rank-row__num">{u.rank}</div>
                      <div className="rank-row__main">
                        <div className="rank-row__avatar">{initials(u.name)}</div>
                        <div className="rank-row__info">
                          <h4>{u.name}</h4>
                          <p>@{u.username || 'donor'}</p>
                        </div>
                        <div className="rank-row__score">{formatPHP(u.totalDonated)}</div>
                        <div className="rank-row__meta">{u.donationCount} donations</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="leaderboard-cta">
                <Button variant="secondary" size="lg" onClick={() => navigate({ to: '/charities' })}>
                  Donate Now
                </Button>
              </div>
            </>
          )}
        </Container>
      </section>
    </PageLayout>
  );
}
