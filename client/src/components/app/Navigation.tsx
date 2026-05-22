import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import logo from '@/assets/logo.png';
import { Button, MenuIcon, CloseIcon } from '@/components/ui';
import { authApi, getToken } from '@/services/api';
import './navigation.css';

type StoredUser = { id: number; email: string; role: string };

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem('aidvocate_thesis_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export default function Navigation() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (getToken()) setUser(readStoredUser());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    authApi.logout();
    localStorage.removeItem('aidvocate_thesis_user');
    setUser(null);
    navigate({ to: '/login' });
  };

  const initial = user?.email ? user.email[0].toUpperCase() : 'U';
  const isAuthenticated = !!user;

  return (
    <nav>
      <a href="/" className="logo-link">
        <img src={logo} alt="AIDVOCATE" />
      </a>

      <div className="separator">
        <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
          <a href="/" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="/charities" onClick={() => setMenuOpen(false)}>Charities</a>
          <a href="/events" onClick={() => setMenuOpen(false)}>Events</a>
          <a href="/leaderboards" onClick={() => setMenuOpen(false)}>Leaderboard</a>
          <a href="/donate" onClick={() => setMenuOpen(false)}>Donate</a>
          <a href="/donations" onClick={() => setMenuOpen(false)}>My Donations</a>
        </div>

        <div className="nav-icons">
          <div className="profile-menu-container" ref={profileMenuRef}>
            {isAuthenticated ? (
              <>
                <button
                  className="icon-btn profile-btn"
                  aria-label="Profile menu"
                  aria-expanded={profileMenuOpen}
                  onClick={() => setProfileMenuOpen((v) => !v)}
                >
                  <div className="profile-avatar">
                    <span>{initial}</span>
                  </div>
                </button>

                {profileMenuOpen && (
                  <div className="profile-menu" role="menu">
                    <div className="profile-menu-header">
                      <div className="profile-menu-avatar">
                        <span>{initial}</span>
                      </div>
                      <div className="profile-menu-info">
                        <h3>{user?.email}</h3>
                      </div>
                    </div>

                    <hr className="profile-menu-divider" />

                    <div className="profile-menu-items">
                      <a href="/dashboard" className="profile-menu-item" role="menuitem">
                        <span>Dashboard</span>
                      </a>
                      <a href="/donations" className="profile-menu-item" role="menuitem">
                        <span>My Donations</span>
                      </a>
                      <a href="/verify-donation" className="profile-menu-item" role="menuitem">
                        <span>Verify Donation</span>
                      </a>
                      <button
                        className="profile-menu-item logout-item"
                        onClick={handleLogout}
                        role="menuitem"
                      >
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => navigate({ to: '/login' })}>
                Login
              </Button>
            )}
          </div>
        </div>

        <button
          className="burger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
    </nav>
  );
}
