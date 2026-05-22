import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import clockIcon from '@/assets/Clock.png';
import locationIcon from '@/assets/event-location.png';
import unlikeHeart from '@/assets/Unlike-Heart.png';
import likeHeart from '@/assets/Like-Heart.png';
import eventFallback from '@/assets/event-pic.png';
import { eventApi, type EventItem, getToken } from '@/services/api';
import './eventCard.css';

interface EventCardProps {
  event: EventItem;
}

export default function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const isAuthed = !!getToken();

  useEffect(() => {
    if (!isAuthed) return;
    eventApi.isLiked(event.id).then(setLiked).catch(() => {});
  }, [event.id, isAuthed]);

  const handleLike = async () => {
    if (!isAuthed) {
      toast.error('Please log in to like this event.');
      return;
    }
    try {
      if (liked) {
        await eventApi.unlike(event.id);
        setLiked(false);
      } else {
        await eventApi.like(event.id);
        setLiked(true);
      }
    } catch {
      toast.error('Error updating like status.');
    }
  };

  const start = new Date(event.dateStart);
  const end = event.dateEnd ? new Date(event.dateEnd) : null;
  const day = start.getDate();
  const month = start.toLocaleString('default', { month: 'long' });
  const timeStart = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const truncate = (s: string | null | undefined, n: number) =>
    s ? (s.length > n ? s.slice(0, n) + '...' : s) : '';

  return (
    <div className="event-card">
      <div className="details">
        <div className="header">
          <div className="title">
            <h5 className="status">Upcoming Event</h5>
            <h2>{event.name}</h2>
          </div>
          <div className="date">
            <h4 id="event-day">{day}</h4>
            <h4 className="event-month">{month}</h4>
          </div>
        </div>

        <p className="description">{truncate(event.description, 70)}</p>

        <div className="infos">
          <img src={clockIcon} alt="Time" />
          <div className="venue-details">
            <p>{timeStart}</p>
            {timeEnd && <p>{timeEnd}</p>}
          </div>
        </div>

        <div className="infos">
          <img src={locationIcon} alt="Location" />
          <div className="venue-details">
            <p>{truncate(event.location, 50) || 'N/A'}</p>
          </div>
        </div>

        <div className="engagement-section">
          <img
            src={liked ? likeHeart : unlikeHeart}
            alt={liked ? 'Liked' : 'Like'}
            className="like"
            onClick={handleLike}
          />
          <button
            className="view-details"
            onClick={() => navigate({ to: '/event/$id', params: { id: String(event.id) } })}
          >
            View Details
          </button>
        </div>
      </div>

      <img src={event.image || eventFallback} alt={event.name} />
    </div>
  );
}
