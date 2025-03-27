const axios = require('axios');
const express = require('express');
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();



// Telegram Bot Configuration
const MY_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`;

// Twitter Client Configuration
const twitterClient = new TwitterApi({
  appKey: process.env.API_KEY,
  appSecret: process.env.API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});
const twitterBearer = new TwitterApi(process.env.BEARER_TOKEN).readOnly;

// State management (in-memory, replace with database in production)
const userStates = {};
const userData = {};

// Telegram API helper
const telegramApi = {
  async sendMessage(chatId, text) {
    try {
      await axios.post(`${BASE_URL}/sendMessage`, {
        chat_id: chatId,
        text: text,
      });
    } catch (error) {
      console.error('Telegram API Error:', error.response?.data);
    }
  }
};

// Twitter API helpers
async function getTweetCommenters(tweetUrl) {
  try {
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) throw new Error('Invalid Twitter URL');

    // Get conversation ID (for replies)
    const tweet = await twitterBearer.v2.singleTweet(tweetId, {
      expansions: ['referenced_tweets.id']
    });
    const conversationId = tweet.data.conversation_id || tweetId;

    // Get commenters (replies to the tweet)
    const commenters = new Set();
    let paginationToken = null;
    
    do {
      const replies = await twitterBearer.v2.tweetsSearch({
        query: `conversation_id:${conversationId}`,
        max_results: 100,
        'tweet.fields': 'author_id',
        pagination_token: paginationToken
      });
      
      for (const tweet of replies.tweets) {
        commenters.add(tweet.author_id);
      }
      
      paginationToken = replies.meta.next_token;
    } while (paginationToken);

    return commenters;
  } catch (error) {
    console.error('Twitter API Error:', error);
    throw new Error('Failed to fetch commenters');
  }
}

function extractTweetId(url) {
  const match = url.match(/twitter\.com\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Telegram Bot Handlers
async function handleStart(chatId) {
  userStates[chatId] = 'AWAITING_MAIN_TWEET';
  await telegramApi.sendMessage(chatId, 
    "Welcome! Please send me the URL of the main Twitter post (Post A):");
}

async function handleMainTweet(chatId, tweetUrl) {
  try {
    const commenters = await getTweetCommenters(tweetUrl);
    userData[chatId] = {
      mainTweet: tweetUrl,
      mainCommenters: commenters,
      otherTweets: [],
      otherCommenters: []
    };
    userStates[chatId] = 'AWAITING_OTHER_TWEETS';
    await telegramApi.sendMessage(chatId, 
      "Main tweet received. Now please send me the URLs of other tweets to compare (one at a time). " +
      "Send /done when you're finished.");
  } catch (error) {
    await telegramApi.sendMessage(chatId, 
      `Error: ${error.message}. Please send a valid Twitter URL.`);
  }
}

async function handleOtherTweet(chatId, tweetUrl) {
  try {
    const commenters = await getTweetCommenters(tweetUrl);
    userData[chatId].otherTweets.push(tweetUrl);
    userData[chatId].otherCommenters.push(commenters);
    await telegramApi.sendMessage(chatId, 
      `Tweet added for comparison. You've added ${userData[chatId].otherTweets.length} tweets. ` +
      "Send another URL or /done to finish.");
  } catch (error) {
    await telegramApi.sendMessage(chatId, 
      `Error: ${error.message}. Please send a valid Twitter URL.`);
  }
}

async function handleDone(chatId) {
  const data = userData[chatId];
  if (!data || data.otherTweets.length === 0) {
    await telegramApi.sendMessage(chatId, 
      "Not enough data to compare. Please start over with /start.");
    return;
  }

  let results = [];
  for (let i = 0; i < data.otherTweets.length; i++) {
    const uniqueCommenters = new Set([...data.mainCommenters]);
    for (const userId of data.otherCommenters[i]) {
      uniqueCommenters.delete(userId);
    }
    
    results.push({
      comparedWith: data.otherTweets[i],
      uniqueCommenters: [...uniqueCommenters]
    });
  }

  // Format results
  let message = `Comparison results for ${data.mainTweet}:\n\n`;
  results.forEach((result, index) => {
    message += `Compared with tweet ${index + 1} (${result.comparedWith}):\n`;
    message += `Unique commenters (did not comment here): ${result.uniqueCommenters.length}\n`;
    if (result.uniqueCommenters.length > 0) {
      message += `User IDs: ${result.uniqueCommenters.join(', ')}\n`;
    }
    message += '\n';
  });

  await telegramApi.sendMessage(chatId, message);
  
  // Reset user state
  delete userStates[chatId];
  delete userData[chatId];
}

// Main message handler
async function handleMessage(messageObj) {
  if (!messageObj) return;

  const chatId = messageObj.chat.id;
  const messageText = messageObj.text || '';

  if (messageText.startsWith('/')) {
    const command = messageText.substring(1).toLowerCase();
    switch (command) {
      case 'start':
        return handleStart(chatId);
      case 'done':
        return handleDone(chatId);
      default:
        return telegramApi.sendMessage(chatId, "Unknown command. Try /start to begin.");
    }
  } else {
    const state = userStates[chatId];
    if (state === 'AWAITING_MAIN_TWEET') {
      return handleMainTweet(chatId, messageText);
    } else if (state === 'AWAITING_OTHER_TWEETS') {
      return handleOtherTweet(chatId, messageText);
    } else {
      return telegramApi.sendMessage(chatId, 
        "Please start the process with /start or finish with /done.");
    }
  }
}

// Express Server Setup
const app = express();
app.use(express.json());

// Telegram Webhook Endpoint
app.post('/telegram-webhook', async (req, res) => {
    console.log("Telegram webhook hit!"); // Debug log
    try {
        const messageObj = req.body.message;
        if (messageObj) {
            await handleMessage(messageObj);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error');
    }
});

// Optional: Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Bot server is running!');
});


const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});