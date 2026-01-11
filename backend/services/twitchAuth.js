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

    try {
        const response = await axios.post(
            'https://id.twitch.tv/oauth2/token',
            null, // Тело запроса
            {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials' // тип авторизации
                }
            }
        );

        const { access_token, expires_in } = response.data;

        this.accessToken = access_token;
        this.tokenExpires = Date.now() + (expires_in * 1000); // через 2 месяца токен умрет

        console.log('Twitch access token received!');
        return this.accessToken;
    }
    catch (error) {
        console.log('Error getting token!', error.response?.data || error.message);
        throw error;
    }
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