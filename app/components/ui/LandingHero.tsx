import { motion } from 'framer-motion';

export function LandingHero() {
    return (
        <div className="relative w-full py-20 px-4 sm:px-6 lg:px-8">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-50 via-white to-gold-50 dark:from-accent-950 dark:via-gray-950 dark:to-gold-950 opacity-50" />

            <div className="relative max-w-4xl mx-auto text-center">
                {/* Main headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
                >
                    <span className="bg-gradient-to-r from-accent-700 via-accent-500 to-gold-500 bg-clip-text text-transparent">
                        Build apps instantly with AI
                    </span>
                </motion.h1>

                {/* Tagline */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="text-xl sm:text-2xl text-bolt-elements-textSecondary mb-4"
                >
                    Powered for Africa
                </motion.p>

                {/* Supporting text */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-lg text-bolt-elements-textTertiary mb-10 max-w-2xl mx-auto"
                >
                    Transform your ideas into production-ready applications with the power of AI.
                    No coding experience required.
                </motion.p>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                >
                    <button className="px-8 py-4 bg-gradient-to-r from-accent-700 to-accent-600 hover:from-accent-800 hover:to-accent-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                        Start Building Now
                    </button>
                    <button className="px-8 py-4 border-2 border-accent-600 text-accent-700 dark:text-accent-400 font-semibold rounded-lg hover:bg-accent-50 dark:hover:bg-accent-950 transition-all duration-200">
                        Watch Demo
                    </button>
                </motion.div>

                {/* Feature badges */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    className="mt-12 flex flex-wrap gap-4 justify-center text-sm text-bolt-elements-textSecondary"
                >
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full border border-bolt-elements-borderColor">
                        <span className="w-2 h-2 bg-accent-500 rounded-full" />
                        <span>AI-Powered</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full border border-bolt-elements-borderColor">
                        <span className="w-2 h-2 bg-gold-500 rounded-full" />
                        <span>No Code Required</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full border border-bolt-elements-borderColor">
                        <span className="w-2 h-2 bg-accent-500 rounded-full" />
                        <span>Deploy Instantly</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
