import axios from 'axios';
import dotenv from 'dotenv'; 

dotenv.config();

class TwitchAuthService {

    constructor() {
        this.clientId = process.env.TWITCH_CLIENT_ID;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
        this.accessToken = null;
        this.tokenExpires = null;
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpires > Date.now()) {
            return this.accessToken;
        }

        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await axios.post(
                    'https://id.twitch.tv/oauth2/token',
                    null,
                    {
                        params: {
                            client_id: this.clientId,
                            client_secret: this.clientSecret,
                            grant_type: 'client_credentials'
                        },
                        timeout: 8000
                    }
                );

                const { access_token, expires_in } = response.data;

                this.accessToken = access_token;
                this.tokenExpires = Date.now() + (expires_in * 1000);

                return this.accessToken;
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries - 1) {
                    const delay = 500 * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
        }

        console.log('Error getting token!', lastError?.response?.data || lastError?.message);
        throw lastError;
    }
   async getAuthHeaders() {
        const token = await this.getAccessToken();
        return {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}` // доказательство, что есть права
        };
    }
}

export default new TwitchAuthService();