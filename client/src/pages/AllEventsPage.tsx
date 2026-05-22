import { PageLayout, Container, SectionTitle, Loading, EmptyState } from '@/components/ui';
import EventCard from '@/components/app/EventCard';
import { useEvents } from '@/hooks';
import './listPage.css';

export default function AllEventsPage() {
  const { data: events, loading } = useEvents();

  return (
    <PageLayout>
      <section className="list-page">
        <Container size="narrow">
          <SectionTitle eyebrow="Stay updated" title="Events" />
          <p className="list-page__lead">Browse upcoming volunteer opportunities and fundraisers.</p>

          {loading ? (
            <Loading />
          ) : !events || events.length === 0 ? (
            <EmptyState
              title="No events yet"
              description="Check back soon for new volunteer opportunities."
            />
          ) : (
            <div className="event-list">
              {events.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </PageLayout>
  );
}
