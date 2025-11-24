export const VideoSection = () => (
  <div className="w-full max-w-2xl mx-auto mb-8 sm:mb-16">
    <div className="relative w-full aspect-video rounded-2xl border border-bolt-elements-borderColor border-opacity-50 shadow-2xl overflow-hidden">
      <iframe
        src="https://www.youtube.com/embed/2dDWt7Sq8M8?rel=0&modestbranding=1"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        title="Replay.Builder - Rebuild your vibe-broken apps"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  </div>
);
