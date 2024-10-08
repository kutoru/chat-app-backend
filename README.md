To run this backend, create a `.env` file and fill it out according to the following format:
```
DB_USER=admin
DB_PASS=admin
DB_NAME=chat_app
TOKEN_TTL=600
TOKEN_SECRET=token_secret
MAX_FILE_SIZE_IN_MB=10
```

Then, install the dependencies with
```
npm i
```

Create the database tables with
```
npm run db-up
```

Run the app in the watch mode with
```
npm run dev
```
