

  <h2 align="center">🤖 Twitter Comment Fetcher Telegram Bot</h2>
  <h3 align="center">A Telegram bot that retrieves the usernames of all users who commented on a specific tweet. Designed to simplify engagement tracking, community analysis, or giveaways by automating the extraction of replies from Twitter posts—right from Telegram.

</h3>

   
## 📋 <a name="table">Table of Contents</a>

1. 🤖 [Introduction](#introduction)
2. ⚙️ [Tech Stack](#tech-stack)
3. 🔋 [Features](#features)
4. 🤸 [Quick Start](#quick-start)
5. 🕸️ [Snippets (Code to Copy)](#snippets)
6. 🔗 [Links](#links)
7. 📦 [Assets](#assets)
8. 🚀 [More](#more)


## <a name="introduction">🤖 Introduction</a>

This Telegram bot allows users to input a tweet link, and in response, the bot returns a list of Twitter usernames that commented on that tweet. It's ideal for managing engagement campaigns, running giveaways, or extracting community feedback without manual scraping.



## <a name="tech-stack">⚙️ Tech Stack</a>

Node.js / Python (choose based on your implementation)

Telegram Bot API (via node-telegram-bot-api or python-telegram-bot)

Twitter API (v2) or Scraper like snscrape

Axios or requests for HTTP requests

dotenv (for environment management)

Hosting: Heroku / Vercel / Railway / Render / Self-hosted VPS


## <a name="features">🔋 Features</a>

👉 Telegram Integration: Easy-to-use interface via a Telegram chat or group.

👉 Tweet Comment Extraction: Fetches all usernames of those who replied to a tweet.

👉 Error Handling: Smart handling of private tweets, API limits, or invalid URLs.

👉 Rate Limit Friendly: Optimized to handle multiple requests without hitting limits.

👉 Username Export: Returns usernames in text format (or .txt file, optional).

👉 Admin Logging: Tracks requests for analytics or abuse prevention.

👉 Deployable Anywhere: Easily deploy on cloud platforms.



and many more, including code architecture and reusability 

## <a name="quick-start">🤸 Quick Start</a>

Follow these steps to set up the project locally on your machine.

**Prerequisites**
Telegram Bot Token

Twitter API Bearer Token (or use snscrape if scraping replies)

Node.js or Python installed

Hosting account (Render/Heroku/etc.)


**Cloning the Repository**

```bash
git clone https://github.com/Adebayotoheeb666/ttbot.git
cd ttbot
```

**Installation**

Install the project dependencies using npm:

```bash
npm install
```
```bash
pip install -r requirements.txt
```

**Set Up Environment Variables**

Create a new file named `.env` in the root of your project and add the following content:

```env
TELEGRAM_BOT_TOKEN=your_telegram_token
TWITTER_BEARER_TOKEN=your_twitter_api_token
```

Replace the placeholder values with your actual credentials. 

**Running the Project**

```bash
node index.js
```

```bash
python bot.py
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the project.

Open Telegram, search for your bot, and start chatting!

**🔗 Links**
<br/>
Telegram Bot API

Twitter Developer Docs

snscrape (Alt to API)

node-telegram-bot-api

python-telegram-bot

dotenv




