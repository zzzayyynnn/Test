# Discord Raid Bot

Automatic Discord bot that posts raid updates every 15 minutes based on Philippine time.  
Raid rotation occurs every 30 minutes. Infinite loop.

## Setup

1. Clone this repository
2. Run `npm install`
3. Fill in `config.json`:
   - `token` → your bot token
   - `raidChannelId` → the Discord channel ID
   - `startRaid` → which raid to start with (e.g., "Subway")
4. Run bot:  
   ```bash
   npm start
