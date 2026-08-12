interface NavigationProps {
  onGetStarted: () => void;
}

export default function Navigation({ onGetStarted }: NavigationProps) {
  return (
    <nav aria-label="Primary navigation">
      <div className="wrap nav-in">
        <a className="brand" href="/" aria-label="WindowMan home">
          <div className="mark" aria-hidden="true">WM</div>
          WINDOW<span>MAN</span>
        </a>
        <div className="nav-right">
          <div className="nav-tag">Independent · Not a contractor</div>
          <button className="btn btn-primary btn-sm" type="button" onClick={onGetStarted}>
            Start My Check
          </button>
        </div>
      </div>
    </nav>
  );
}
