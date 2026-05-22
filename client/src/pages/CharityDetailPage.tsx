import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PageLayout, Container, Button, Loading } from '@/components/ui';
import EventCard from '@/components/app/EventCard';
import DonationModal from '@/components/app/DonationModal';
import { useOrganization } from '@/hooks';
import { organizationApi, getToken, type EventItem } from '@/services/api';
import charityFallback from '@/assets/charity-pic.png';
import './detailPage.css';

interface Props { id: string; }

export default function CharityDetailPage({ id }: Props) {
  const { data: org, loading } = useOrganization(id);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [liked, setLiked] = useState(false);
  const [volunteered, setVolunteered] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const isAuthed = !!getToken();

  useEffect(() => {
    organizationApi.getEvents(id).then(setEvents).catch(() => setEvents([]));
    if (isAuthed) {
      organizationApi.isLiked(id).then(setLiked).catch(() => {});
      organizationApi.isVolunteered(id).then(setVolunteered).catch(() => {});
    }
  }, [id, isAuthed]);

  if (loading || !org) {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  const handleLike = async () => {
    if (!isAuthed) {
      toast.error('Please log in to like this charity.');
      return;
    }
    try {
      if (liked) {
        await organizationApi.unlike(org.id);
        setLiked(false);
      } else {
        await organizationApi.like(org.id);
        setLiked(true);
      }
    } catch {
      toast.error('Could not update like.');
    }
  };

  const handleVolunteer = async () => {
    if (!isAuthed) {
      toast.error('Please log in to volunteer.');
      return;
    }
    try {
      if (volunteered) {
        await organizationApi.unvolunteer(org.id);
        setVolunteered(false);
      } else {
        await organizationApi.volunteer(org.id);
        setVolunteered(true);
      }
    } catch {
      toast.error('Could not update volunteer status.');
    }
  };

  return (
    <PageLayout>
      <div className="detail-page">
        <div
          className="detail-page__cover"
          style={{ backgroundImage: `url('${org.coverImage || charityFallback}')` }}
        >
          <div className="detail-page__overlay" />
        </div>
        <Container size="narrow">
          <div className="detail-page__body">
            <h1 className="detail-page__title">{org.name}</h1>
            <ul className="detail-page__meta">
              {org.location && <li>{org.location}</li>}
              <li>{org.volunteerCount ?? 0} volunteers</li>
              <li>PHP {(org.totalRaised ?? 0).toLocaleString()} raised</li>
            </ul>
            {org.categories && org.categories.length > 0 && (
              <div className="detail-page__chips">
                {org.categories.map((c) => (
                  <span key={c} className="detail-page__chip">{c}</span>
                ))}
              </div>
            )}
            <p className="detail-page__description">{org.description}</p>

            <div className="detail-page__actions">
              <Button variant="primary" size="lg" onClick={() => setShowDonate(true)}>
                Donate
              </Button>
              <Button variant="secondary" size="lg" onClick={handleVolunteer}>
                {volunteered ? 'Volunteered ✓' : 'Volunteer'}
              </Button>
              <Button variant="ghost" size="lg" onClick={handleLike}>
                {liked ? '♥ Liked' : '♡ Like'}
              </Button>
            </div>

            <h2 className="detail-page__section-title">Upcoming events</h2>
            {events.length === 0 ? (
              <p className="detail-page__empty">No events scheduled.</p>
            ) : (
              <div className="event-list">
                {events.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            )}
          </div>
        </Container>
      </div>
      <DonationModal isOpen={showDonate} onClose={() => setShowDonate(false)} organization={org} />
    </PageLayout>
  );
}
