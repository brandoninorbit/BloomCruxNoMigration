// CommonJS form is the least finicky on Windows/Next 15.
// Tailwind v4 requires the new plugin id.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
