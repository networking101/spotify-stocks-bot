# spotify-stocks-bot
A bot that changes which Spotify playlists are playing depending on stock prices

## Setup

Install nodejs

Install required modules:
* express
* request
* cors
* cookie-parser

```npm install express```

Do not change the the redirect uri.  The app needs to call back to that specific url and port

## How it Works

When you login, your the bot will require you to login and ask for the necessary permissions to your spotify account.

Enter a stock symbol to track. For example: tsla
Enter a "Going Up Playlist" that the bot will play when the stock is increasing.
Same thing for "Going Down Playlist".
"Going Up Playlist" will start playing until the bot can determine the trend of the stock.

The bot will check the price of the stock every minute.  If it sees a continual increase or decrease for 5 minutes, the corresponding playlist will start playing (if not already playing).  You may have to wait a while until the bot can determine the trend.  Once found you should see the direction indicated.

The price will be printed under the the "Start Music" button.  If the price looks incorrect, the bot is probably not getting the accurate price and you may need to pick another stock.
