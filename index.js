import axios from 'axios';
import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
dotenv.config();

// ===== Configuration =====
const MY_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`;
const PORT = process.env.PORT || 4040;

// ===== Twitter Client Setup =====
const twitterClient = new TwitterApi({
  appKey: process.env.API_KEY,
  appSecret: process.env.API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});
const client = twitterClient.readWrite;

// ===== State Management =====
const userStates = {};
const userData = {};

// ===== Rate Limiter =====
class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 280) {
    this.lastRequestTime = 0; // Track the last request time

    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = []; // Track request timestamps

  }

  async wait() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldest = this.requests[0];
      const waitTime = Math.min(this.windowMs, this.windowMs * Math.pow(2, this.requests.length - this.maxRequests)); // Exponential backoff

      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.wait();
    }
    
    this.requests.push(now);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// ===== Helper Functions =====
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
    url = String(url).trim();
    if (!/https?:\/\//i.test(url)) url = 'https://' + url;
    return url
      .replace(/(x\.com|mobile\.twitter\.com)/i, 'twitter.com')
      .split('?')[0]
      .split('#')[0];
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
    }).catch(err => ({
      request: { res: { responseUrl: url } }
    }));
    return response.request.res.responseUrl || url;
  } catch (error) {
    console.error('URL resolution error:', error);
    return url;
  }
}

function extractTweetId(url) {
  try {
    const normalized = normalizeTwitterUrl(url);
    const match = normalized?.match(
      /twitter\.com\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i
    );
    return match?.[2] ?? null;
  } catch (error) {
    console.error('Tweet ID extraction error:', error);
    return null;
  }
}

async function safeTwitterCall(fn) {
  try {
    await rateLimiter.wait();
    const response = await fn().catch(async err => {
      if (err.response?.status === 429) {
        console.error('Rate limit exceeded. Waiting before retrying...');
        await new Promise(resolve => setTimeout(resolve, this.windowMs)); // Wait before retrying
      }
      throw err; // Rethrow the error
    });

    
    if (response?.meta?.result_count === 0 && !response?.data) {
      throw new Error('Empty API response');
    }
    
    return response;
  } catch (error) {
    if (error.code === 400) {
      console.error('Bad request details:', {
        url: error.config?.url,
        params: error.config?.params
      });
    }
    throw error;
  }
}

function validateTwitterRequest(params) {
  const invalidParams = Object.entries(params)
    .filter(([_, value]) => value === null);
  
  if (invalidParams.length > 0) {
    throw new Error(`Invalid params: ${invalidParams.map(([key]) => key).join(', ')}`);
  }
  return true;
}

// ===== Core Twitter Functions =====
async function getTweetCommenters(tweetUrl) {
  try {
    const resolvedUrl = await resolveShortUrl(tweetUrl);
    const tweetId = extractTweetId(resolvedUrl);
    
    if (!tweetId) throw new Error('Invalid Twitter URL format');

    // Get conversation ID
    const tweet = await safeTwitterCall(() => 
      client.v2.singleTweet(tweetId, {
        expansions: ['referenced_tweets.id'],
        'tweet.fields': ['conversation_id']
      })
    );

    const conversationId = tweet.data.conversation_id || tweetId;
    const commenters = new Set();
    let paginationToken = undefined;

    do {
      const requestParams = {
        query: `conversation_id:${conversationId}`,
        max_results: 100,
        'tweet.fields': ['author_id']
      };
      
      if (paginationToken) {
        requestParams.pagination_token = paginationToken;
      }

      validateTwitterRequest(requestParams);

      const replies = await safeTwitterCall(() => 
        client.v2.search(requestParams)
      );

      for (const tweet of replies.tweets) {
        if (tweet.author_id) commenters.add(tweet.author_id);
      }
      
      paginationToken = replies.meta?.next_token;
    } while (paginationToken);

    return commenters;
  } catch (error) {
    console.error('Error in getTweetCommenters:', { 
      error: error.message,
      url: tweetUrl,
      timestamp: new Date().toISOString(),
      requestsMade: this.requests.length, // Log the number of requests made

      error: error.message,
      url: tweetUrl,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Failed to fetch commenters: ${error.message}`);
  }
}

// ===== Bot Handlers =====
async function handleStart(chatId) {
  userStates[chatId] = 'AWAITING_MAIN_TWEET';
  await telegramApi.sendMessage(chatId,
    `📢 *Twitter Comment Analyzer Bot*\n\n` +
    `1. Send main tweet URL\n` +
    `2. Send comparison URLs (one by one)\n` +
    `3. Type \`/done\` when finished\n\n` +
    `✅ Supported formats:\n` +
    `• twitter.com/user/status/123\n` +
    `• x.com/user/status/123\n` +
    `• t.co links`
  );
}

async function validateAndProcessTweet(chatId, url, isMainTweet = false) {
  try {
    const normalizedUrl = normalizeTwitterUrl(url);
    if (!normalizedUrl) throw new Error('Invalid URL format');

    const commenters = await getTweetCommenters(normalizedUrl);
    
    if (isMainTweet) {
      userData[chatId] = {
        mainTweet: normalizedUrl,
        mainCommenters: commenters,
        otherTweets: [],
        otherCommenters: []
      };
      userStates[chatId] = 'AWAITING_OTHER_TWEETS';
      return "✅ Main tweet saved! Now send comparison tweets.";
    } else {
      userData[chatId].otherTweets.push(normalizedUrl);
      userData[chatId].otherCommenters.push(commenters);
      return `📥 Added comparison tweet (${userData[chatId].otherTweets.length} total)`;
    }
  } catch (error) {
    console.error('Error processing tweet:', error);
    throw error;
  }
}

async function handleDone(chatId) {
  const data = userData[chatId];
  if (!data?.otherTweets?.length) {
    await telegramApi.sendMessage(chatId,
      "⚠️ Need at least one comparison tweet\nType /start to begin again");
    return;
  }

  try {
    let message = `🔍 *Results for:* [Main Tweet](${data.mainTweet})\n\n`;
    
    data.otherTweets.forEach((tweetUrl, index) => {
      const uniqueCommenters = new Set([...data.mainCommenters]);
      for (const userId of data.otherCommenters[index]) {
        uniqueCommenters.delete(userId);
      }
      
      message += `➡️ [Tweet ${index + 1}](${tweetUrl})\n`;
      message += `👥 Unique commenters: ${uniqueCommenters.size}\n`;
      if (uniqueCommenters.size > 0) {
        message += `🔹 User IDs: \`${Array.from(uniqueCommenters).join(', ')}\`\n\n`;
      }
    });

    await telegramApi.sendMessage(chatId, message);
  } catch (error) {
    await telegramApi.sendMessage(chatId, "❌ Error generating results");
    console.error('Comparison error:', error);
  } finally {
    delete userStates[chatId];
    delete userData[chatId];
  }
}

async function handleMessage(messageObj) {
  if (!messageObj) return;

  const chatId = messageObj.chat.id;
  const messageText = messageObj.text?.trim() || '';

  try {
    if (messageText.startsWith('/')) {
      const command = messageText.substring(1).toLowerCase();
      switch (command) {
        case 'start': return await handleStart(chatId);
        case 'done': return await handleDone(chatId);
        default: return await telegramApi.sendMessage(chatId,
          "❌ Unknown command\n/start - Begin\n/done - Finish");
      }
    }

    const state = userStates[chatId];
    if (!state) return await telegramApi.sendMessage(chatId, "🔹 Start with /start");

    const isValidUrl = /(https?:\/\/)?(www\.)?(twitter\.com|x\.com|t\.co)\/\w+\/status\/\d+/i.test(messageText);
    if (!isValidUrl) {
      return await telegramApi.sendMessage(chatId,
        "❌ Invalid Twitter URL\nExample: `https://twitter.com/user/status/123`");
    }

    const response = await validateAndProcessTweet(
      chatId,
      messageText,
      state === 'AWAITING_MAIN_TWEET'
    );
    await telegramApi.sendMessage(chatId, response);

  } catch (error) {
    let userMessage = "⚠️ Error: ";
    if (error.message.includes('400')) {
      userMessage += "Invalid request. Please try a different tweet.";
    } else if (error.message.includes('429')) {
      userMessage += "API limits exceeded. Please wait 15-30 minutes.";
    } else if (error.message.includes('401')) {
      userMessage += "Authentication failed. The bot needs maintenance.";
    } else {
      userMessage += "Please try again later.";
    }
    
    await telegramApi.sendMessage(chatId, userMessage);
    console.error('Handler error:', {
      error: error.message,
      stack: error.stack,
      chatId,
      text: messageText,
      timestamp: new Date().toISOString()
    });
  }
}

// ===== Server Setup =====
const app = express();
app.use(express.json());

// Validate environment variables
function validateConfig() {
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'API_KEY',
    'API_SECRET',
    'ACCESS_TOKEN',
    'ACCESS_SECRET'
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length) {
    console.error('Missing environment variables:', missing);
    process.exit(1);
  }
}
validateConfig();

// Webhook endpoint
app.post('/telegram-webhook', async (req, res) => {
  try {
    console.log('Incoming update:', req.body?.update_id);
    await handleMessage(req.body.message);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'running',
    timestamp: new Date().toISOString(),
    rateLimit: {
      current: rateLimiter.requests.length,
      max: rateLimiter.maxRequests,
      window: `${rateLimiter.windowMs / 1000}s`
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Webhook URL: https://your-domain.com/telegram-webhook`);
  console.log(`⚙️ Current rate limit: ${rateLimiter.requests.length}/${rateLimiter.maxRequests}`);
});
