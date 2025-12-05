export const IntroSection = () => {
  return (
    <div id="intro" className="max-w-4xl mx-auto px-6 lg:px-8 mt-8 mb-4 overflow-visible">
      <div className="text-center mb-4 overflow-visible">
        <h1
          className="text-4xl lg:text-7xl font-bold text-bolt-elements-textHeading mb-6 animate-fade-in animation-delay-100 leading-[1.15] overflow-visible"
          style={{ lineHeight: '1.15' }}
        >
          Own your tools
          <br />
          with web apps that
          <br />
          <span className="relative inline-block">
            work
            {/* Wavy underline decoration */}
            <svg
              className="absolute -bottom-2 left-0 w-full"
              height="8"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 4C10 4 10 1 20 1C30 1 30 7 40 7C50 7 50 1 60 1C70 1 70 7 80 7C90 7 90 4 100 4"
                stroke="#60A5FA"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="text-lg lg:text-xl mb-10 text-bolt-elements-textSecondary animate-fade-in animation-delay-200 leading-relaxed max-w-2xl mx-auto">
          Build and customize web apps for you and your team in minutes.
        </p>
      </div>
    </div>
  );
};
