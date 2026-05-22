import { useNavigate } from '@tanstack/react-router';
import { PageLayout, Container, SectionTitle, Button, Loading, EmptyState } from '@/components/ui';
import CharityCard from '@/components/app/CharityCard';
import EventCard from '@/components/app/EventCard';
import { useOrganizations, useEvents } from '@/hooks';
import circleCheck from '@/assets/circle-check.png';
import alignmentPic from '@/assets/alignment-pic.jpg';
import involvedPic from '@/assets/involved-pic.jpg';
import handIcon from '@/assets/handIcon.png';
import solidarity from '@/assets/solidarity.png';
import './homePage.css';

const VALUE_PROPS = [
  'Choose a charity',
  'Check alignment',
  'Get involved',
  'Make the world a better place',
];

export default function HomePage() {
  const navigate = useNavigate();
  const { data: orgs, loading: orgsLoading } = useOrganizations();
  const { data: events, loading: eventsLoading } = useEvents({ upcomingOnly: true });

  const featuredOrgs = (orgs ?? []).slice(0, 3);
  const featuredEvents = (events ?? []).slice(0, 2);

  return (
    <PageLayout>
      <div className="home">
        <section className="hero" id="home">
          <div className="hero__inner">
            <h1>AIDVOCATE</h1>
            <p>We make it easy for anyone to contribute to making a positive impact in their communities and beyond.</p>
            <div className="hero__cta">
              <Button variant="secondary" size="lg" onClick={() => navigate({ to: '/charities' })}>
                Donate Now
              </Button>
              <Button variant="ghost" size="lg" onClick={() => navigate({ to: '/events' })}>
                Browse Events
              </Button>
            </div>
          </div>
        </section>

        <section className="section section--world">
          <Container>
            <SectionTitle eyebrow="Be the change" title="Aid and Advocate" />
            <div className="value-prop">
              <div className="value-prop__images">
                <button className="floating-btn floating-btn--top" aria-label="Donate">
                  <img src={solidarity} alt="" />
                </button>
                <button className="floating-btn floating-btn--mid" aria-label="Help">
                  <img src={handIcon} alt="" />
                </button>
                <img src={involvedPic} alt="" className="value-prop__img value-prop__img--main" />
                <img src={alignmentPic} alt="" className="value-prop__img value-prop__img--overlay" />
              </div>
              <div className="value-prop__copy">
                <p className="value-prop__eyebrow">Who we are</p>
                <h3 className="value-prop__title">Empowering Change Through Connection</h3>
                <hr />
                <p className="value-prop__body">
                  Join us and make your life more valuable and useful — be a part of us and contribute to the nation
                  and state and the simplest things for the environment and yourself.
                </p>
                <ul className="value-prop__list">
                  {VALUE_PROPS.map((label) => (
                    <li key={label}>
                      <img src={circleCheck} alt="" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="primary" onClick={() => navigate({ to: '/charities' })}>
                  About Us
                </Button>
              </div>
            </div>
          </Container>
        </section>

        <section className="section section--spotlight">
          <Container>
            <SectionTitle eyebrow="Become part of something great" title="Spotlight causes" />
            <div className="spotlight">
              <div className="spotlight__details">
                <h3>WE WANT TO SERVE THE WORLD AROUND US</h3>
                <p>
                  Our goal is to shine a spotlight on the causes that matter the most. We aim to inspire action and
                  awareness for the betterment of society and the environment.
                </p>
              </div>
            </div>
          </Container>
        </section>

        <section className="section">
          <Container>
            <SectionTitle eyebrow="Get involved" title="Charities in Davao" />
            {orgsLoading ? (
              <Loading />
            ) : featuredOrgs.length === 0 ? (
              <EmptyState title="No charities yet" description="Be the first to support a cause when they appear here." />
            ) : (
              <div className="card-grid card-grid--charities">
                {featuredOrgs.map((org) => (
                  <CharityCard key={org.id} organization={org} />
                ))}
              </div>
            )}
            <div className="section__cta">
              <Button variant="secondary" onClick={() => navigate({ to: '/charities' })}>
                See more
              </Button>
            </div>
          </Container>
        </section>

        <section className="section">
          <Container size="narrow">
            <SectionTitle eyebrow="Stay updated" title="This month's events" />
            {eventsLoading ? (
              <Loading />
            ) : featuredEvents.length === 0 ? (
              <EmptyState
                title="No upcoming events"
                description="Check back soon for new volunteer opportunities."
              />
            ) : (
              <div className="event-list">
                {featuredEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            )}
            <div className="section__cta">
              <Button variant="ghost" onClick={() => navigate({ to: '/events' })}>
                View all events
              </Button>
            </div>
          </Container>
        </section>
      </div>
    </PageLayout>
  );
}
