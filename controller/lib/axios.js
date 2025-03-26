const axios = require('axios');
const MY_TOKEN = '7808380299:AAEQlUTmLAfEJ5wFVWCp1e5-_mRa5j-xkAg';

const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`;
function getAxiosInstance() {
    return {
        get(method, param) {
            return axios.get(`/${method}`, {
                baseURL: BASE_URL,
                params,
            });
        },
        post (method, data) {
            return axios({
                method: 'post',
                baseURL: BASE_URL,
                url: `/${method}`,
                data,
            });
        },
    };
}