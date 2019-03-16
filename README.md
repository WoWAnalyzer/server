# WoWAnalyzer.com server

This repo containers the server hosting WoWAnalyzer.com. It does not include any analysis code, that can be found on [the main repository](https://github.com/WoWAnalyzer/WoWAnalyzer). This houses our internal API and login mechanisms, such as WCL and Battle.net API proxies and caches.

## Development environment

### Configuration

This is needed for both options. Copy `.env.local.example` (name it `.env.local`) and configure the API keys you're going to need. **You don't need to configure everything.**

- WCL API key can be found at the bottom of this page: https://www.warcraftlogs.com/profile
- Battle.net API client can be created here: https://develop.battle.net/access/clients
- GitHub OAuth can be configured here: https://github.com/settings/developers
- Patreon OAuth can be configured here: https://www.patreon.com/portal/registration/register-clients

Note if you change something in the `.env` files you may need to restart your development server if it's already running.

### Standard (recommended)

#### Database
A database server is required to run the server.

If you have something running already, just configure it in the `.env.local`. If you're not using MariaDB, you will need to install one of the following dependencies and configure the `MYSQL_DIALECT` accordingly in the `.env.local` file:

```
npm install --no-save pg pg-hstore # Postgres
npm install --no-save mysql2
npm install --no-save mariadb
npm install --no-save sqlite3
npm install --no-save tedious # Microsoft SQL Server
```

Otherwise either run `docker-compose up -d database` to start a Docker database (__recommended__) or install [MariaDB](https://downloads.mariadb.org/).

#### Dev server
1. Install dependencies: `npm install`
2. Fire her up: `npm start`

Now the development server is available at http://localhost:3001. It will recompile automatically but not refresh.

#### Installing new dependencies
- `npm install --save new-dependency` for a production dependency
- `npm install --save-dev new-dependency` for a development dependency

### Docker

1. `docker-compose up`

Now the development server is available at http://localhost:3001. It will recompile automatically but not refresh.

#### Watching output
`docker-compose logs -f server`

#### Installing new dependencies
Either:
- Add it to package.json and run `docker-compose up --build -d`
- `docker-compose exec server npm install --save new-dependency`

### Combining with the SPA dev server

See [the main repository](https://github.com/WoWAnalyzer/WoWAnalyzer) for instructions on how to start the SPA development server. For the max development pleasure, run the SPA development like normally and change the server it uses to your server path. In the SPA root make a `.env.development.local` and add the line: `REACT_APP_SERVER_BASE=http://localhost:3001/`. Restart the SPA development server and it will now use your own server for API calls.

Alternaitvely if you want to test the proxy, you should use the standard environment. It will proxy the SPA development server by default. The Docker environment seems to be unable to connect to your SPA development server.

## Production environment

1. `docker build --tag wowanalyzer-server .`
2. `docker run wowanalyzer-server`

Now the production server is available at http://localhost:3001.
