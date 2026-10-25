export function SceneLoading({
  failed = false,
  connected = true,
}: {
  failed?: boolean;
  connected?: boolean;
}) {
  const pending = !failed;
  return (
    <div
      className={`scene-placeholder${pending ? ' is-drawing' : ' is-unavailable'}`}
      role="status"
      aria-live="polite"
      aria-busy={pending}
    >
      <svg viewBox="0 0 180 130" fill="none" aria-hidden="true">
        <g className="scene-sketch-bottle" stroke="currentColor" strokeWidth="1.4">
          <path d="M80 27v21c0 8-14 12-14 23v23c0 5 4 9 9 9h29c5 0 9-4 9-9V71c0-11-14-15-14-23V27" />
          <path d="M78 27h23M79 21h21v6H79zM86 58l17 4-6 27-17-4zM87 66l9 2M85 73l9 2" />
          <path d="M72 75v16c0 3 2 6 5 6" opacity=".45" />
        </g>
        <path
          className="scene-sketch-water"
          d="M32 108c9-3 14-3 23 0s14 3 23 0 14-3 23 0 14 3 23 0 14-3 23 0M52 116c9-2 14-2 23 0s14 2 23 0 14-2 23 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <p>
        {failed
          ? 'Illustration unavailable. Your words are saved.'
          : connected
            ? 'Drawing your postcard…'
            : 'Reconnecting to your postcard…'}
      </p>
    </div>
  );
}
