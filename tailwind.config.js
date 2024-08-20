module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  // purge: [ './index.html', './src/**/*.vue', './src/**/*.jsx', ],
  // enabled: true,
  // darkMode: false, 
  theme: {
    extend: {
      spacing: {
        '16': '16px',
      },
      borderRadius: {
        '6': '6px',
      }
    },
    screens: {
      'sm': '640px',
      md: '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
  corePlugins: {
    'transitionProperty': false,
    'transitionDelay': false,
    'transitionDuration': false,
    'transitionTimingFunction': false,
    'animation': false,
    'animationDelay': false,
    'animationDirection': false,
    'animationDuration': false,
    'animationFillMode': false,
    'animationIterationCount': false,
    'animationName': false,
    'animationPlayState': false,
    'animationTimingFunction': false,
    backdropBlur: false,
    backdropBrightness: false,
    backdropContrast: false,
    backdropDropShadow: false,
    backdropFilter: false,
    backdropGrayscale: false,
    backdropHueRotate: false,
    backdropInvert: false,
    backdropOpacity: false,
    backdropSaturate: false,
    backdropSepia: false,
    backgroundAttachment: false,
    backgroundBlendMode: false,
    backgroundClip: false,
    backgroundColor: false,
    backgroundOpacity: false,
    backgroundPosition: false,
    backgroundRepeat: false,
    backgroundSize: false,
    hover: false,
    focus: false,
    active: false,
    groupHover: false,
    ringColor: false,
    ringOffsetColor: false,
    ringOffsetWidth: false,
    ringOpacity: false,
    ringWidth: false,
    boxShadow: false,
    gradientColorStops: false,
    

  }

}
