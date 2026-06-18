const config = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                bg: "#f4f1ea",
                card: "#fffdf8",
                ink: "#1e293b",
                muted: "#64748b",
                accent: "#0f766e",
                accentSoft: "#d9f1ee",
                line: "#e5ded0"
            },
            boxShadow: {
                soft: "0 16px 40px rgba(15, 23, 42, 0.08)"
            }
        }
    },
    plugins: []
};
export default config;
