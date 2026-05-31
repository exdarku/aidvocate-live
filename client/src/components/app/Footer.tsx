import logo from '@/assets/logo.png';
import phone from '@/assets/phone.png';
import location from '@/assets/location.png';
import email from '@/assets/email.png';
import './footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <img className="site-footer__logo" src={logo} alt="AidVocate" />
            <p className="site-footer__tagline">
              Connecting communities with causes, one act of kindness at a time.
            </p>
          </div>

          <ul className="site-footer__contact">
            <li>
              <img src={phone} alt="" aria-hidden="true" />
              <a href="tel:+6392832834">(639) 283 - 2834</a>
            </li>
            <li>
              <img src={email} alt="" aria-hidden="true" />
              <a href="mailto:charity@email.com">charity@email.com</a>
            </li>
            <li>
              <img src={location} alt="" aria-hidden="true" />
              <span>231 Matina, Davao City</span>
            </li>
          </ul>
        </div>

        <div className="site-footer__divider" />

        <div className="site-footer__bottom">
          <p className="site-footer__credit">
            Made with love by{' '}
            <a href="https://www.facebook.com/luminatechph" target="_blank" rel="noreferrer">
              Lumina Tech
            </a>
            .
          </p>
          <p className="site-footer__copyright">© {year} AidVocate. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
