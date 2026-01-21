export const IntroSection = () => {
  return (
    <div id="intro" className="max-w-4xl mx-auto px-6 lg:px-8 mt-8 mb-4 overflow-visible">
      <div className="text-center mb-4 overflow-visible">
        <h1
          className="text-4xl lg:text-6xl font-bold text-bolt-elements-textHeading mb-6 animate-fade-in animation-delay-100 leading-[1.15] overflow-visible"
          style={{ lineHeight: '1.15' }}
        >
          Own your tools
          <br />
          with web apps that work
        </h1>

        <p className="text-lg lg:text-xl mb-10 text-bolt-elements-textSecondary animate-fade-in animation-delay-200 leading-relaxed max-w-2xl mx-auto">
          Build and customize web apps for you and your team in minutes.
        </p>
      </div>
    </div>
  );
};
