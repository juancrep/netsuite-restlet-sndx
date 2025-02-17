const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const config = {
    CONSUMER_KEY: 'fba3f58b3335ac1a0f97e8ecf77e4c488d141eb1ef8402c393ae86eb6ef659b1',
    CONSUMER_SECRET: 'add083a9877b1ab20bd63a22d19bdd3a5ea3257fe9bfc2d894cf0574fa99c22d',
    ACCESS_TOKEN: '7fb022667a8295f91706d7bfa1ac15d6c430d2de0dda16a91a69619b55962cd3',
    TOKEN_SECRET: 'ad47652f0df2a418576ed4c7f55f1908a3eb25f51805aca0b3927f1379086c7f',
    ACCOUNT_ID: '8019768',
    SCRIPT_ID: '2906',
    DEPLOY_ID: '1'
};

// Create OAuth 1.0a instance
const oauth = OAuth({
    consumer: { 
        key: config.CONSUMER_KEY, 
        secret: config.CONSUMER_SECRET 
    },
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
        return crypto.createHmac('sha256', key).update(base_string).digest('base64');
    }
});

const generateOAuthHeader = (method, url, token) => {
    // Include full URL in request data
    const requestData = {
        url: url,
        method: method,
        data: {} // Include empty data object for POST requests
    };

    // Get OAuth authorization
    const authData = oauth.authorize(requestData, token);

    // Format authorization header with required NetSuite parameters
    const headerParams = {
        realm: config.ACCOUNT_ID,
        oauth_consumer_key: authData.oauth_consumer_key,
        oauth_token: authData.oauth_token,
        oauth_signature_method: authData.oauth_signature_method,
        oauth_timestamp: authData.oauth_timestamp,
        oauth_nonce: authData.oauth_nonce,
        oauth_version: '1.0',
        oauth_signature: authData.oauth_signature
    };

    // Build OAuth header string
    const headerString = 'OAuth ' + Object.entries(headerParams)
        .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
        .join(', ');

    return headerString;
};

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res)=>{
    res.send("Bienvenido")
})

// Nueva ruta para consultar un artículo por upccode
app.post('/api/item', async (req, res) => {
    try {
        // Extraer el UPC code del cuerpo de la solicitud POST
        const { upccode } = req.body;

        // Validar que el UPC code no esté vacío
        if (!upccode || upccode.trim() === '') {
            console.error('Server Error: UPC code is required');
            return res.status(400).json({
                success: false,
                message: "UPC code is required"
            });
        }

        console.log('Received UPC Code:', upccode); // Log del UPC recibido

        // Construir la URL para el restlet de NetSuite
        const url = `https://8019768.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${config.SCRIPT_ID}&deploy=${config.DEPLOY_ID}&upccode=${encodeURIComponent(upccode)}`;

        // Generar el encabezado OAuth para autenticación
        const token = { key: config.ACCESS_TOKEN, secret: config.TOKEN_SECRET };
        const authHeader = generateOAuthHeader('GET', url, token);
        console.log('Generated OAuth Header:', authHeader); // Log del encabezado OAuth

        // Realizar la solicitud GET al restlet de NetSuite
        const response = await axios.get(url, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            }
        });

        console.log('NetSuite Response:', response.data); // Log de la respuesta de NetSuite

        // Enviar la respuesta al cliente
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error Details:', error.response?.data || error.message); // Log detallado del error
        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Error fetching item',
            error: error.response?.data || error.message
        });
    }
});

// New route for creating inventory record
app.post('/api/inventory', async (req, res) => {
    try {
        const { sku, description, quantity } = req.body;

        // Validate required fields
        if (!sku || !description || typeof quantity !== 'number') {
            return res.status(400).json({
                success: false,
                message: "All fields are required. SKU and description must be strings, quantity must be a number."
            });
        }

        console.log('Received Inventory Data:', { sku, description, quantity });

        const url = `https://8019768.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${config.SCRIPT_ID}&deploy=${config.DEPLOY_ID}`;

        const token = { key: config.ACCESS_TOKEN, secret: config.TOKEN_SECRET };
        const authHeader = generateOAuthHeader('POST', url, token);
        console.log('Generated OAuth Header:', authHeader);

        const response = await axios.post(url, 
            { sku, description, quantity },
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                }
            }
        );

        console.log('NetSuite Response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error Details:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: 'Error creating inventory record',
            error: error.response?.data || error.message
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});