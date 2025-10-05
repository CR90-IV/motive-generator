# London Grid Square Generator

A web app that randomly selects Ordnance Survey grid squares within Greater London and displays them on a map.

## Features

- Random 1km grid square selection within Greater London boundaries
- OS Grid Reference display (e.g., TQ 30000 80000)
- Interactive map with highlighted grid square
- Mobile-friendly responsive design

## Usage

Simply open `index.html` in a web browser or visit the GitHub Pages deployment.

Click the "Randomise" button to generate a random grid square.

## Deployment

This app is configured to run on GitHub Pages. To deploy:

1. Push this repository to GitHub
2. Go to Settings > Pages
3. Set Source to "Deploy from a branch"
4. Select the `main` branch and root folder
5. Save

Your app will be available at `https://[username].github.io/motive-generator/`

## Technology

- Leaflet.js for mapping
- Ordnance Survey National Grid conversion algorithms
- Pure JavaScript (no build process required)
