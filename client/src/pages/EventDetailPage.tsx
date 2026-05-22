import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PageLayout, Container, Button, Loading } from '@/components/ui';
import DonationModal from '@/components/app/DonationModal';
import { useEvent } from '@/hooks';
import {
  eventApi,
  organizationApi,
  getToken,
  type Organization,
} from '@/services/api';
import eventFallback from '@/assets/event-pic.png';
import './detailPage.css';

interface Props { id: string; }

export default function EventDetailPage({ id }: Props) {
  const { data: event, loading } = useEvent(id);
  const [org, setOrg] = useState<Organization | null>(null);
  const [liked, setLiked] = useState(false);
  const [volunteered, setVolunteered] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const isAuthed = !!getToken();

  useEffect(() => {
    if (!event) return;
    if (event.organizationId) {
      organizationApi.getById(event.organizationId).then(setOrg).catch(() => setOrg(null));
    }
    if (isAuthed) {
      eventApi.isLiked(event.id).then(setLiked).catch(() => {});
      eventApi.isVolunteered(event.id).then(setVolunteered).catch(() => {});
    }
  }, [event, isAuthed]);

  if (loading || !event) {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  const start = new Date(event.dateStart);
  const end = event.dateEnd ? new Date(event.dateEnd) : null;

  const handleLike = async () => {
    if (!isAuthed) {
      toast.error('Please log in.');
      return;
    }
    try {
      if (liked) await eventApi.unlike(event.id);
      else await eventApi.like(event.id);
      setLiked(!liked);
    } catch {
      toast.error('Could not update like.');
    }
  };

  const handleVolunteer = async () => {
    if (!isAuthed) {
      toast.error('Please log in.');
      return;
    }
    try {
      if (volunteered) await eventApi.unvolunteer(event.id);
      else await eventApi.volunteer(event.id);
      setVolunteered(!volunteered);
    } catch {
      toast.error('Could not update volunteer status.');
    }
  };

  return (
    <PageLayout>
      <div className="detail-page">
        <div
          className="detail-page__cover"
          style={{ backgroundImage: `url('${event.image || eventFallback}')` }}
        >
          <div className="detail-page__overlay" />
        </div>
        <Container size="narrow">
          <div className="detail-page__body">
            <h1 className="detail-page__title">{event.name}</h1>
            <ul className="detail-page__meta">
              {event.organization && <li>by {event.organization.name}</li>}
              <li>{start.toLocaleString()}</li>
              {end && <li>– {end.toLocaleString()}</li>}
              {event.location && <li>{event.location}</li>}
            </ul>
            <p className="detail-page__description">{event.description}</p>

            <div className="detail-page__actions">
              {org && (
                <Button variant="primary" size="lg" onClick={() => setShowDonate(true)}>
                  Donate
                </Button>
              )}
              <Button variant="secondary" size="lg" onClick={handleVolunteer}>
                {volunteered ? 'Volunteered ✓' : 'Volunteer'}
              </Button>
              <Button variant="ghost" size="lg" onClick={handleLike}>
                {liked ? '♥ Liked' : '♡ Like'}
              </Button>
            </div>
          </div>
        </Container>
      </div>
      {org && (
        <DonationModal
          isOpen={showDonate}
          onClose={() => setShowDonate(false)}
          organization={org}
          event={event}
        />
      )}
    </PageLayout>
  );
}
