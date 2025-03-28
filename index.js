const axios = require('axios');
const express = require('express');
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

// ========== CONFIGURATION ==========
const MY_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`;
const PORT = process.env.PORT || 4040;

// Twitter Client
const twitterBearer = new TwitterApi(process.env.BEARER_TOKEN).readOnly;

// State management
const userStates = {};
const userData = {};

// ========== HELPER FUNCTIONS ==========
const telegramApi = {
  async sendMessage(chatId, text, parse_mode = 'Markdown') {
    try {
      await axios.post(`${BASE_URL}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: parse_mode
      });
    } catch (error) {
      console.error('Telegram API Error:', error.response?.data);
    }
  }
};

function normalizeTwitterUrl(url) {
  if (!url) return null;
  
  try {
    // Convert to string and trim
    url = String(url).trim();
    
    // Basic validation
    if (!/https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Normalize domain
    url = url.replace(/(x\.com|mobile\.twitter\.com)/i, 'twitter.com');
    
    // Remove query parameters and fragments
    url = url.split('?')[0].split('#')[0];
    
    return url;
  } catch (error) {
    console.error('URL normalization error:', error);
    return null;
  }
}

async function resolveShortUrl(url) {
  if (!url.includes('t.co/')) return url;
  
  try {
    const response = await axios.get(url, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    }).catch(err => {
      return { request: { res: { responseUrl: url } } }; // Fallback to original
    });
    return response.request.res.responseUrl || url;
  } catch (error) {
    console.error('URL resolution error:', error);
    return url;
  }
}

function extractTweetId(url) {
  try {
    const normalized = normalizeTwitterUrl(url);
    if (!normalized) return null;
    
    const match = normalized.match(/twitter\.com\/\w+\/status\/(\d+)/i);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Tweet ID extraction error:', error);
    return null;
  }
}

async function getTweetCommenters(url) {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error('Invalid tweet ID');
  }

  try {
    const tweet = await twitterBearer.v2.tweet(tweetId, {
      expansions: ['author_id'],
      'tweet.fields': ['public_metrics']
    });

    // Assuming the tweet object contains a list of commenters
    const commenters = tweet.includes.users.map(user => user.id);
    return commenters;
  } catch (error) {
    console.error('Error fetching tweet commenters:', error);
    throw new Error('Failed to fetch tweet commenters');
  }
}
async function getTweetCommenters(url) {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error('Invalid tweet ID');
  }

  try {
    const tweet = await twitterBearer.v2.tweet(tweetId, {
      expansions: ['author_id'],
      'tweet.fields': ['public_metrics']
    });

    // Assuming the tweet object contains a list of commenters
    const commenters = tweet.includes.users.map(user => user.id);
    return commenters;
  } catch (error) {
    console.error('Error fetching tweet commenters:', error);
    throw new Error('Failed to fetch tweet commenters');
  }
}


// ========== BOT HANDLERS ==========
async function handleStart(chatId) {
  userStates[chatId] = 'AWAITING_MAIN_TWEET';
  await telegramApi.sendMessage(chatId,
    "📢 *Welcome to Twitter Comment Analyzer Bot!*\n\n" +
    "🔹 *How to use:*\n" +
    "1. Send me the *main tweet URL* (Post A)\n" +
    "2. Send *comparison tweet URLs* one by one\n" +
    "3. Type `/done` when finished\n\n" +
    "✅ *Accepted URL formats:*\n" +
    "- `https://twitter.com/user/status/123`\n" +
    "- `https://x.com/user/status/123`\n" +
    "- `t.co` shortened links\n\n" +
    "📌 *Example:*\n" +
    "`https://twitter.com/elonmusk/status/123456789`");
}

async function validateAndProcessTweet(chatId, url, isMainTweet = false) {
  try {
    const normalizedUrl = normalizeTwitterUrl(url);
    if (!normalizedUrl) {
      throw new Error('Invalid URL provided');
    }

    const commenters = await getTweetCommenters(normalizedUrl);
    
    if (isMainTweet) {
      userData[chatId] = {
        mainTweet: normalizedUrl,
        mainCommenters: commenters,
        otherTweets: [],
        otherCommenters: []
      };
      userStates[chatId] = 'AWAITING_OTHER_TWEETS';
      return "✅ *Main tweet saved!* Now send me comparison tweets one by one.\nType `/done` when finished.";
    } else {
      userData[chatId].otherTweets.push(normalizedUrl);
      userData[chatId].otherCommenters.push(commenters);
      const count = userData[chatId].otherTweets.length;
      return `📥 Added comparison tweet (${count} total). Send another or /done to finish.`;
    }
  } catch (error) {
    console.error(`Error processing tweet: ${error.message}`);
    throw error;
  }
}

async function handleDone(chatId) {
  const data = userData[chatId];
  if (!data || data.otherTweets.length === 0) {
    await telegramApi.sendMessage(chatId, 
      "⚠️ Not enough data to compare. Please send at least one comparison tweet.\n" +
      "Type /start to begin again.");
    return;
  }

  try {
    let message = `🔍 *Comparison Results for:* [Main Tweet](${data.mainTweet})\n\n`;
    
    data.otherTweets.forEach((tweetUrl, index) => {
      const uniqueCommenters = new Set([...data.mainCommenters]);
      for (const userId of data.otherCommenters[index]) {
        uniqueCommenters.delete(userId);
      }
      
      message += `➡️ *Compared with:* [Tweet ${index + 1}](${tweetUrl})\n`;
      message += `👥 *Unique commenters:* ${uniqueCommenters.size}\n`;
      
      if (uniqueCommenters.size > 0) {
        message += `🔹 *User IDs:* \`${Array.from(uniqueCommenters).join(', ')}\`\n\n`;
      } else {
        message += "No unique commenters found.\n\n";
      }
    });

    await telegramApi.sendMessage(chatId, message);
  } catch (error) {
    await telegramApi.sendMessage(chatId, 
      "❌ Error generating comparison results. Please try again.");
    console.error('Comparison error:', error);
  } finally {
    delete userStates[chatId];
    delete userData[chatId];
  }
}

async function handleMessage(messageObj) {
  if (!messageObj) return;

  const chatId = messageObj.chat.id;
  const messageText = messageObj.text || '';

  try {
    if (messageText.startsWith('/')) {
      const command = messageText.substring(1).toLowerCase().trim();
      switch (command) {
        case 'start':
          return await handleStart(chatId);
        case 'done':
          return await handleDone(chatId);
        default:
          return await telegramApi.sendMessage(chatId, 
            "❌ Unknown command. Available commands:\n/start - Begin analysis\n/done - Finish and compare");
      }
    } else {
      const state = userStates[chatId];
      if (!state) {
        return await telegramApi.sendMessage(chatId,
          "🔹 Please start the process with /start");
      }

      const urlPattern = /(https?:\/\/)?(www\.)?(twitter\.com|x\.com|t\.co)\/\w+\/status\/\d+/i;
      if (!urlPattern.test(messageText)) {
        return await telegramApi.sendMessage(chatId,
          "❌ Invalid Twitter URL format. Please send a valid tweet URL.\n" +
          "Example: `https://twitter.com/username/status/123456789`");
      }

      if (state === 'AWAITING_MAIN_TWEET') {
        const response = await validateAndProcessTweet(chatId, messageText, true);
        await telegramApi.sendMessage(chatId, response);
      } else if (state === 'AWAITING_OTHER_TWEETS') {
        const response = await validateAndProcessTweet(chatId, messageText);
        await telegramApi.sendMessage(chatId, response);
      }
    }
  } catch (error) {
    await telegramApi.sendMessage(chatId,
      `❌ Error: ${error.message}\n\nPlease try again or /start to begin fresh.`);
    console.error('Message handling error:', error);
  }
}

// ========== SERVER SETUP ==========
const app = express();
app.use(express.json());

app.post('/telegram-webhook', async (req, res) => {
  try {
    console.log('Incoming update:', JSON.stringify(req.body, null, 2));
    await handleMessage(req.body.message);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://your-domain.com/telegram-webhook`);
});