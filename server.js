require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fetch = require('node-fetch');
const nlp = require('compromise');
const multer = require('multer');
// Optional Cloudinary support for persistent uploads
let cloudinary;
if (process.env.CLOUDINARY_URL) {
    try {
        cloudinary = require('cloudinary').v2;
        cloudinary.config({ url: process.env.CLOUDINARY_URL });
        console.log('Cloudinary configured');
    } catch (err) {
        console.warn('Cloudinary module not available or failed to configure:', err.message);
        cloudinary = null;
    }
}
const path = require('path');
const app = express();

const { pipeline } = require('@xenova/transformers');

let webllmPipeline;

(async () => {
    console.log('Loading WebLLM model...');
    webllmPipeline = await pipeline('text-generation', 'Xenova/gpt-2'); // lightweight model
    console.log('WebLLM loaded ✅');
})();


// Middleware setup
app.use(cors());
app.use(express.json());
// Serve static assets from the public folder (so frontend files work in production)
app.use(express.static(path.join(__dirname, 'public')));


// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Create server and WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket error handling
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});
// File Upload Setup
// If Cloudinary is configured, accept files in memory and upload to Cloudinary.
const upload = cloudinary ? multer({ storage: multer.memoryStorage() }) : multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, 'uploads'),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    })
});

// API Functions
async function getDictionaryDefinition(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            const meanings = entry.meanings.map(meaning => ({
                partOfSpeech: meaning.partOfSpeech,
                definitions: meaning.definitions.map(def => ({
                    definition: def.definition,
                    example: def.example || null
                }))
            }));

            return {
                success: true,
                word: entry.word,
                phonetic: entry.phonetic || '',
                meanings: meanings
            };
        }
        return { 
            success: false, 
            message: `No definition found for "${word}"`
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getWeatherInfo(city = 'London') {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current_weather=true&hourly=temperature_2m`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        return {
            success: true,
            temperature: data.current_weather.temperature,
            windspeed: data.current_weather.windspeed,
            forecast: data.hourly.temperature_2m.slice(0, 24)
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getActivity() {
    try {
        const response = await fetch('https://www.boredapi.com/api/activity');
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        return {
            success: true,
            activity: data.activity,
            type: data.type
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getQuote() {
    try {
        const response = await fetch('https://api.quotable.io/random');
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        return {
            success: true,
            quote: data.content,
            author: data.author
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getEducationInfo(query) {
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        return {
            success: true,
            title: data.title,
            content: data.extract
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getBooksInfo(query) {
    try {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        if (data.docs && data.docs.length > 0) {
            return {
                success: true,
                books: data.docs.map(book => ({
                    title: book.title,
                    author: book.author_name?.[0] || 'Unknown',
                    year: book.first_publish_year
                }))
            };
        }
        return { success: false, message: 'No books found' };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getRecipesInfo(query) {
    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        if (data.meals && data.meals.length > 0) {
            return {
                success: true,
                recipes: data.meals.map(meal => ({
                    name: meal.strMeal,
                    category: meal.strCategory,
                    instructions: meal.strInstructions
                }))
            };
        }
        return { success: false, message: 'No recipes found' };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getMoviesInfo(query) {
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query + ' (film)')}`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        return {
            success: true,
            title: data.title,
            description: data.extract
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}

async function getNewsInfo() {
    try {
        const response = await fetch('https://en.wikipedia.org/api/rest_v1/feed/featured/');
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();

        const news = data.news?.map(item => ({
            title: item.title,
            description: item.description
        })) || [];

        return {
            success: true,
            articles: news
        };
    } catch (error) {
        return { success: false, error: 'Service unavailable' };
    }
}
// Main route for the application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// WebSocket message handler
wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`Client connected (ID: ${clientId})`);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connection_status',
        status: 'connected',
        message: 'Connected to Smile Bot Server'
    }));

 ws.on('message', async (message) => {
    try {
        const data = JSON.parse(message);

        if (data.type === 'ai_query') {
            const userQuery = data.query;
            const sector = data.sector;

            let response;

            switch(sector) {
                case 'Education':
                    response = await getEducationInfo(userQuery);
                    break;
                case 'Dictionary':
                    response = await getDictionaryDefinition(userQuery);
                    break;
                case 'Weather':
                    response = await getWeatherInfo(userQuery);
                    break;
                case 'Entertainment':
                    response = await getActivity();
                    break;
                case 'Wellbeing':
                    response = await getQuote();
                    break;
                case 'News':
                    response = await getNewsInfo();
                    break;
                case 'Books':
                    response = await getBooksInfo(userQuery);
                    break;
                case 'Recipes':
                    response = await getRecipesInfo(userQuery);
                    break;
                case 'Movies':
                    response = await getMoviesInfo(userQuery);
                    break;
                default:
                    // fallback to WebLLM
                    if (webllmPipeline) {
                        const output = await webllmPipeline(userQuery, { max_new_tokens: 100 });
                        response = { success: true, reply: output[0].generated_text };
                    } else {
                        response = { success: false, error: 'WebLLM not loaded yet' };
                    }
            }

            ws.send(JSON.stringify({
                type: 'ai_response',
                results: response
            }));
        }

    } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Error processing your request'
        }));
    }
});


    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});
// Route already defined above

// AI Response Route
app.post('/ai-response', async (req, res) => {
    const { message, sector } = req.body;
    try {
        let response;
        const doc = nlp(message);

        switch(sector) {
            case 'Education':
                response = await getEducationInfo(message);
                break;
            case 'Dictionary':
                response = await getDictionaryDefinition(message);
                break;
            case 'Weather':
                const location = doc.match('#City').text() || 'London';
                response = await getWeatherInfo(location);
                break;
            case 'Entertainment':
                response = await getActivity();
                break;
            case 'Wellbeing':
                response = await getQuote();
                break;
            case 'News':
                response = await getNewsInfo();
                break;
            case 'Books':
                response = await getBooksInfo(message);
                break;
            case 'Recipes':
                response = await getRecipesInfo(message);
                break;
            case 'Movies':
                response = await getMoviesInfo(message);
                break;
            default:
                response = { success: false, message: "Please select a valid category." };
        }

        res.json(response);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Service unavailable' });
    }
});

// Advanced Search Route
app.post('/advanced-search', async (req, res) => {
    const { query, sector } = req.body;
    if (!query || !sector) {
        return res.status(400).json({ success: false, error: 'Query and sector are required' });
    }

    try {
        let response;

        switch(sector) {
            case 'Education':
                response = await getEducationInfo(query);
                break;
            case 'Dictionary':
                response = await getDictionaryDefinition(query);
                break;
            case 'Weather':
                response = await getWeatherInfo(query); // Optionally pass city
                break;
            case 'Entertainment':
                response = await getActivity();
                break;
            case 'Wellbeing':
                response = await getQuote();
                break;
            case 'News':
                response = await getNewsInfo();
                break;
            case 'Books':
                response = await getBooksInfo(query);
                break;
            case 'Recipes':
                response = await getRecipesInfo(query);
                break;
            case 'Movies':
                response = await getMoviesInfo(query);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid sector' });
        }

        res.json({ success: true, result: response });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Service unavailable' });
    }
});

// File Upload Route
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // If Cloudinary is configured and we used memory storage, upload to Cloudinary
    if (cloudinary && req.file.buffer) {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
            if (error) {
                console.error('Cloudinary upload error:', error);
                return res.status(500).json({ success: false, error: 'Upload failed' });
            }
            return res.json({
                success: true,
                message: 'File uploaded to Cloudinary',
                fileInfo: {
                    name: req.file.originalname,
                    size: req.file.size,
                    url: result.secure_url,
                    provider: 'cloudinary'
                }
            });
        });
        stream.end(req.file.buffer);
        return;
    }

    // Fallback: saved to local disk
    res.json({ 
        success: true,
        message: `File uploaded successfully`,
        fileInfo: {
            name: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
            provider: 'local'
        }
    });
});

app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ 
        status: 'Backend is working!',
        timestamp: new Date().toISOString(),
        apis: {
            education: true,
            dictionary: true,
            weather: true,
            entertainment: true,
            wellbeing: true,
            news: true,
            books: true,
            recipes: true,
            movies: true
        }
    });
});

// advanced serarch modal by Marx prototype test
// Advanced-search route removed for production (feature deprecated/removed)

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('Health check endpoint hit');
    res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
const fs = require('fs');

// Ensure required directories exist
const dirs = {
    uploads: path.join(__dirname, 'uploads'),
   
};

// Create directories if they don't exist
Object.entries(dirs).forEach(([name, dir]) => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created ${name} directory: ${dir}`);
        } catch (err) {
            console.error(`Error creating ${name} directory:`, err);
            process.exit(1);
        }
    }
});

const requiredFiles = {
    'index.html': path.join(__dirname, 'index.html')
};
Object.entries(requiredFiles).forEach(([name, filepath]) => {
    if (!fs.existsSync(filepath)) {
        console.error(`Missing required file: ${name}`);
        console.error(`Expected at: ${filepath}`);
    }
});

// Global error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});

// Function to check if port is in use
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = require('net').createServer()
            .once('error', () => resolve(true))
            .once('listening', () => {
                server.close();
                resolve(false);
            })
            .listen(port);
    });
}

// Start the server with better error handling
async function startServer() {
    try {
        // Check if port is already in use
        const portInUse = await isPortInUse(PORT);
        if (portInUse) {
            console.error(`Port ${PORT} is already in use. Please try a different port or close the application using this port.`);
            process.exit(1);
        }

        server.listen(PORT, '0.0.0.0', (err) => {
            if (err) {
                console.error('Error starting server:', err);
                process.exit(1);
            }
            console.log('\x1b[32m%s\x1b[0m', '🚀 Server is running!');
            console.log('\x1b[36m%s\x1b[0m', `📡 HTTP server listening on port ${PORT}`);
            console.log('\x1b[36m%s\x1b[0m', `🔌 WebSocket server active`);
            console.log('\n\x1b[33m%s\x1b[0m', 'Available APIs:');
            [
                'Education 📚',
                'Dictionary 📖', 
                'Weather 🌤️', 
                'Entertainment 🎬', 
                'Wellbeing 🌟',
                'News 📰',
                'Books 📚',
                'Recipes 🍳',
                'Movies 🎥'
            ].forEach(api => console.log('\x1b[33m%s\x1b[0m', `- ${api}`));
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Please try a different port or close the application using this port.`);
            } else {
                console.error('Server error:', error);
            }
            process.exit(1);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();


