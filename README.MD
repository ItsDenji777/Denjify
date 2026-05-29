# Denjify

A modern local music player built with React and Vite, inspired by Spotify’s desktop experience.

Denjify focuses on smooth animations, synced lyrics, immersive fullscreen playback, and a clean UI that feels fast and native without relying on streaming services.

---

## Preview

<img width="100%" src="./assets/preview.png" alt="Denjify Preview" />

---

## Features

* Local music playback
* Spotify-inspired interface
* Synced lyrics screen
* Animated blurred backgrounds
* Fullscreen player mode
* Smooth scrolling track titles
* Interactive progress & volume controls
* Responsive desktop layout
* Lightweight and fast
* Custom SpotifyMix font support

---

## Built With

* React
* Vite
* React Icons
* CSS3
* HTML5 Audio API

---

## Getting Started

### Requirements

Make sure you have these installed:

* Node.js 18+
* npm

Check versions:

```bash
node -v
npm -v
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/denjify.git
```

Go into the project folder:

```bash
cd denjify
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in your terminal.

Usually:

```bash
http://localhost:5173
```

---

## Building for Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Project Structure

```txt
denjify/
├── public/
│   ├── fonts/
│   └── assets/
├── src/
│   ├── components/
│   ├── styles/
│   ├── hooks/
│   └── App.jsx
├── package.json
└── vite.config.js
```

---

## Custom Fonts

Denjify uses the SpotifyMix font family.

Place your `.woff2` font files inside:

```txt
public/fonts/
```

---

## Screenshots

### Main Player

<img width="100%" src="./assets/player.png" alt="Main Player" />

### Lyrics Screen

<img width="100%" src="./assets/lyrics.png" alt="Lyrics Screen" />

---

## Roadmap

* Playlist support
* Queue system
* Media Session API
* Audio visualizer
* Better lyrics timing
* Theme customization
* Discord Rich Presence
* Keyboard shortcuts

---

## Contributing

Pull requests are welcome.

If you find bugs or want to suggest features, open an issue.

---

## License

MIT License

---

## Notes

Denjify is a personal project and is not affiliated with or endorsed by Spotify.
