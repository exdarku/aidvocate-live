import logo from '@/assets/logo.png';
import './authDetails.css';

interface AuthDetailsProps {
  step: number;
  totalSteps?: number;
}

export default function AuthDetails({ step, totalSteps = 3 }: AuthDetailsProps) {
  return (
    <div className="details">
      <img src={logo} alt="Logo" />
      <div className="text">
        <h1>Building the Future...</h1>
        <p>Empowering individuals to support their communities and create meaningful change around the world.</p>
        <div className="carousel-indicators">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={`indicator ${step === i + 1 ? 'active' : ''}`}></span>
          ))}
        </div>
      </div>
    </div>
  );
}
