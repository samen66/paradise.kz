import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        // Browser runs on host; Docker maps 5174 -> 5173 inside the container.
        origin: 'http://localhost:5174',
        cors: {
            origin: [
                'http://localhost:8080',
                /^https?:\/\/localhost(:\d+)?$/,
            ],
        },
        hmr: {
            host: 'localhost',
            clientPort: 5174,
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
