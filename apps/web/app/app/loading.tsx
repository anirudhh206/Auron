// Route-level loading skeleton for /app
import AuronLogo from "@/components/AuronLogo";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap');

  .app-loading {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: #08080A;
    position: relative;
    overflow: hidden;
  }

  /* Dot grid */
  .app-loading::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(circle, #26262A 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.2;
    pointer-events: none;
  }

  /* Lime top glow */
  .app-loading::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 280px;
    background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(200,241,53,0.05) 0%, transparent 70%);
    pointer-events: none;
  }

  .loading-logo {
    position: relative;
    z-index: 1;
    animation: loadingPulse 1.8s ease-in-out infinite;
  }

  @keyframes loadingPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .loading-bars {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 160px;
  }

  .loading-bar {
    height: 2px;
    border-radius: 999px;
    background: #26262A;
    position: relative;
    overflow: hidden;
  }

  .loading-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, #C8F135, transparent);
    animation: shimmer 1.8s ease-in-out infinite;
    background-size: 200% 100%;
  }

  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  .loading-label {
    position: relative;
    z-index: 1;
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #606068;
    animation: loadingPulse 1.8s ease-in-out infinite;
    animation-delay: 0.3s;
  }
`;

export default function AppLoading() {
  return (
    <>
      <style>{STYLES}</style>
      <div className="app-loading">
        <div className="loading-logo">
          <AuronLogo size={52} />
        </div>

        <div className="loading-bars">
          <div className="loading-bar" style={{ width: "100%", animationDelay: "0s" }} />
          <div className="loading-bar" style={{ width: "75%", animationDelay: "0.15s" }} />
        </div>

        <p className="loading-label">Loading Auron</p>
      </div>
    </>
  );
}
