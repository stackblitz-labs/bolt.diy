export function Footer() {
    return (
        <footer className="w-full border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-700 to-gold-500 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">D</span>
                        </div>
                        <span className="text-bolt-elements-textSecondary text-sm">
                            © Dreamera 2025
                        </span>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-bolt-elements-textSecondary">
                        <a
                            href="#"
                            className="hover:text-accent-600 transition-colors"
                        >
                            About
                        </a>
                        <a
                            href="#"
                            className="hover:text-accent-600 transition-colors"
                        >
                            Privacy
                        </a>
                        <a
                            href="#"
                            className="hover:text-accent-600 transition-colors"
                        >
                            Terms
                        </a>
                        <a
                            href="#"
                            className="hover:text-accent-600 transition-colors"
                        >
                            Contact
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
