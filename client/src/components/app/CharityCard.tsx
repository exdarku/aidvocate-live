import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import arrowUpRight from '@/assets/arrow-up-right.png';
import person from '@/assets/person.png';
import raisedImg from '@/assets/raised.png';
import unlikeHeart from '@/assets/Unlike-Heart.png';
import likeHeart from '@/assets/Like-Heart.png';
import solidarity from '@/assets/solidarity.png';
import charityFallback from '@/assets/charity-pic.png';
import { organizationApi, type Organization, getToken } from '@/services/api';
import DonationModal from './DonationModal';
import './charityCard.css';

interface CharityCardProps {
  organization: Organization;
}

export default function CharityCard({ organization }: CharityCardProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [volunteered, setVolunteered] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const isAuthed = !!getToken();

  useEffect(() => {
    if (!isAuthed) return;
    organizationApi.isLiked(organization.id).then(setLiked).catch(() => {});
    organizationApi.isVolunteered(organization.id).then(setVolunteered).catch(() => {});
  }, [organization.id, isAuthed]);

  const handleLike = async () => {
    if (!isAuthed) {
      toast.error('Please log in to like this charity.');
      return;
    }
    try {
      if (liked) {
        await organizationApi.unlike(organization.id);
        setLiked(false);
      } else {
        await organizationApi.like(organization.id);
        setLiked(true);
      }
    } catch {
      toast.error('Error updating like status.');
    }
  };

  const handleVolunteer = async () => {
    if (!isAuthed) {
      toast.error('Please log in to volunteer.');
      return;
    }
    try {
      if (volunteered) {
        await organizationApi.unvolunteer(organization.id);
        setVolunteered(false);
      } else {
        await organizationApi.volunteer(organization.id);
        setVolunteered(true);
      }
    } catch {
      toast.error('Error updating volunteer status.');
    }
  };

  const truncate = (s: string | null | undefined, n: number) =>
    s ? (s.length > n ? s.slice(0, n) + '...' : s) : '';

  const bg = organization.coverImage || charityFallback;

  return (
    <>
      <div className="charity-card">
        <div className="background" style={{ backgroundImage: `url('${bg}')` }}>
          <div className="categories">
            {(organization.categories ?? []).map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
        </div>

        <div className="description">
          <div className="text-wrapper">
            <h3>{truncate(organization.name, 35)}</h3>
            <img
              src={arrowUpRight}
              alt=""
              onClick={() => navigate({ to: `/charity/$id`, params: { id: String(organization.id) } })}
              style={{ cursor: 'pointer' }}
            />
          </div>

          <p className="charity-description">{truncate(organization.description, 70)}</p>

          <div className="contribution">
            <img src={person} alt="Volunteers" />
            <p>{organization.volunteerCount ?? 0} volunteers</p>
          </div>
          <div className="contribution">
            <img src={raisedImg} alt="Raised" />
            <p>PHP {(organization.totalRaised ?? 0).toLocaleString()} raised</p>
          </div>

          <div className="engagements">
            <img
              src={liked ? likeHeart : unlikeHeart}
              alt={liked ? 'Liked' : 'Like'}
              className="like"
              onClick={handleLike}
            />
            <div className="buttons">
              <button className="donate" onClick={() => setShowDonate(true)}>
                <img src={solidarity} alt="Donate" />
              </button>
              <button className="volunteer" onClick={handleVolunteer}>
                {volunteered ? 'Volunteered' : 'Volunteer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <DonationModal isOpen={showDonate} onClose={() => setShowDonate(false)} organization={organization} />
    </>
  );
}
