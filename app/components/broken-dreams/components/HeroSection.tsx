export const HeroSection = () => {
  return (
    <div className="text-center mb-16">
      <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Rebuild your vibe-broken apps
        </span>
        <br />
        <span className="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
          with Replay.Builder
        </span>
      </h1>

      <p className="text-xl text-bolt-elements-textSecondary mb-8 max-w-3xl mx-auto leading-relaxed">
        Tell us what you’ve been struggling to build, and get three months of our Builder Plan for free ($60 value)
      </p>

      <a
        href="https://form.typeform.com/to/QWeBbEox"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30"
      >
        <span className="text-base sm:text-xl">Submit Your App</span>
      </a>

      <p className="text-sm text-bolt-elements-textSecondary mt-6 max-w-2xl mx-auto">
        Replay.Builder is focused on building web apps. So if you are looking to build native iOS/Android apps, desktop
        apps or Chrome extensions, we're not ready for you...yet.
      </p>
    </div>
  );
};
