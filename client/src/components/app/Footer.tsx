import logo from '@/assets/logo.png';
import phone from '@/assets/phone.png';
import location from '@/assets/location.png';
import email from '@/assets/email.png';
import './footer.css';

export default function Footer() {
  return (
    <footer>
      <img src={logo} alt="Logo" />
      <p>Aidvocate — Connecting communities with causes, one act of kindness at a time.</p>

      <div className="contact">
        <img src={phone} alt="Phone" />
        <p>(639) 283 - 2834</p>
      </div>

      <div className="contact">
        <img src={email} alt="Email" />
        <p>Charity@email.com</p>
      </div>

      <div className="contact">
        <img src={location} alt="Location" />
        <p>231 Matina Davao City</p>
      </div>

      <p className="license">
        Made with love by <a href="https://www.facebook.com/luminatechph">Lumina Tech</a>.
      </p>
      <p className="license-dark">© Charity, All Rights Reserved 2024</p>
    </footer>
  );
}
