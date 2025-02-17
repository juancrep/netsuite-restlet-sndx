// api/item.js
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const config = {
    CONSUMER_KEY: '712d7e9e0138d863bc77e2e5d6ad1b03ee53bf01eaff12d68446ab687925c70b',
    CONSUMER_SECRET: 'e27199db5bd0b2b8c53ac2ed67efdea7692acf84730a431d114fa526c85eacce',
    ACCESS_TOKEN: '8c9d3048b5cc5a15ae0399f22d78ba597319c00e7178f341d571471c2a8f22b3',
    TOKEN_SECRET: 'ecd09cd46597f27b2b7227721235d8d39f3b3fc63041173c901f8a565967279e',
    ACCOUNT_ID: '8019768_SB2',
    SCRIPT_ID: '2890',
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

module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            // Extraer el UPC code del cuerpo de la solicitud POST
            const { upccode } = req.body;

            // Validar que el UPC code no esté vacío
            if (!upccode || upccode.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: "UPC code is required"
                });
            }

            console.log('Received UPC Code:', upccode);

            // Construir la URL para el restlet de NetSuite
            const url = `https://8019768-sb2.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${config.SCRIPT_ID}&deploy=${config.DEPLOY_ID}&upccode=${encodeURIComponent(upccode)}`;

            // Generar el encabezado OAuth para autenticación
            const token = { key: config.ACCESS_TOKEN, secret: config.TOKEN_SECRET };
            const authHeader = generateOAuthHeader('GET', url, token);
            console.log('Generated OAuth Header:', authHeader);

            // Realizar la solicitud GET al restlet de NetSuite
            const response = await axios.get(url, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                }
            });

            console.log('NetSuite Response:', response.data);

            // Enviar la respuesta al cliente
            return res.json({ success: true, data: response.data });

        } else {
            // Si no es un POST, devuelve un error 405 Method Not Allowed
            return res.status(405).json({
                success: false,
                message: 'Method Not Allowed'
            });
        }

    } catch (error) {
        console.error('Error Details:', error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: 'Error fetching item',
            error: error.response?.data || error.message
        });
    }
};
