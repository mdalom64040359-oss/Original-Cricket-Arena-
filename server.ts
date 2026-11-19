import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const CRICKET_API_BASE = 'https://api.cricapi.com/v1';

function parseNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || val === '-' || val === '--') {
    return null;
  }
  const str = String(val).replace(/,/g, '').replace('*', '').trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function parseBowlingFigures(val: unknown): {wickets: number | null; runs: number | null; display: string | null} {
  if (typeof val !== 'string' || !val.includes('/')) {
    return {wickets: null, runs: null, display: null};
  }
  const [wStr, rStr] = val.split('/');
  const wickets = parseNullableNumber(wStr);
  const runs = parseNullableNumber(rStr);
  if (wickets === null || runs === null) {
    return {wickets: null, runs: null, display: null};
  }
  return {wickets, runs, display: `${wickets}/${runs}`};
}

function mapApiMatchTypeToFormatKey(matchType: string): 'test' | 'odi' | 't20i' | 't20-league' | 'domestic' | null {
  const normalized = matchType.trim().toLowerCase();
  if (normalized === 'test') return 'test';
  if (normalized === 'odi') return 'odi';
  if (normalized === 't20i') return 't20i';
  if (normalized === 't20') return 't20-league';
  if (normalized === 'fc' || normalized === 'list-a' || normalized === 'lista' || normalized === 'domestic') {
    return 'domestic';
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/cricket/status', (_req, res) => {
    const apiKey = process.env.CRICKET_API_KEY || process.env.CRICKETDATA_API_KEY || '';
    const configured = apiKey.trim().length > 0;
    res.json({
      configured,
      provider: 'Approved Cricket Data API (api.cricapi.com)',
      message: configured
        ? 'Approved Cricket API key is active on the server.'
        : 'No CRICKET_API_KEY configured on the server. Local match scoring, manual entry, and JSON import remain fully available.',
    });
  });

  app.get('/api/cricket/players', async (req, res) => {
    const apiKey = (process.env.CRICKET_API_KEY || process.env.CRICKETDATA_API_KEY || '').trim();
    const search = String(req.query.search || '').trim();

    if (!apiKey) {
      res.json({
        configured: false,
        players: [],
        message: 'Approved Cricket API key is not configured on the server.',
      });
      return;
    }

    if (search.length < 2) {
      res.status(400).json({
        configured: true,
        players: [],
        message: 'Enter at least 2 characters to search.',
      });
      return;
    }

    try {
      const url = `${CRICKET_API_BASE}/players?apikey=${encodeURIComponent(apiKey)}&offset=0&search=${encodeURIComponent(search)}`;
      const upstream = await fetch(url);
      if (!upstream.ok) {
        res.status(502).json({
          configured: true,
          players: [],
          message: `Approved Cricket API returned HTTP ${upstream.status}.`,
        });
        return;
      }
      const payload = (await upstream.json()) as {
        status?: string;
        reason?: string;
        data?: Array<{id?: string; name?: string; country?: string}>;
      };

      if (payload.status !== 'success') {
        res.status(502).json({
          configured: true,
          players: [],
          message: payload.reason || 'Approved Cricket API did not return a success status.',
        });
        return;
      }

      const players = (payload.data ?? [])
        .filter((item) => item.id && item.name)
        .slice(0, 20)
        .map((item) => ({
          id: String(item.id),
          name: String(item.name),
          country: item.country ? String(item.country) : undefined,
        }));

      res.json({
        configured: true,
        players,
        source: 'Approved Cricket API (CricketData v1)',
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(502).json({
        configured: true,
        players: [],
        message: err instanceof Error ? err.message : 'Unable to reach Approved Cricket API.',
      });
    }
  });

  app.get('/api/cricket/player-info', async (req, res) => {
    const apiKey = (process.env.CRICKET_API_KEY || process.env.CRICKETDATA_API_KEY || '').trim();
    const playerId = String(req.query.id || '').trim();

    if (!apiKey) {
      res.json({
        configured: false,
        profile: null,
        message: 'Approved Cricket API key is not configured on the server.',
      });
      return;
    }

    if (!playerId) {
      res.status(400).json({configured: true, profile: null, message: 'Player id is required.'});
      return;
    }

    try {
      const url = `${CRICKET_API_BASE}/players_info?apikey=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(playerId)}`;
      const upstream = await fetch(url);
      if (!upstream.ok) {
        res.status(502).json({
          configured: true,
          profile: null,
          message: `Approved Cricket API returned HTTP ${upstream.status}.`,
        });
        return;
      }

      const payload = (await upstream.json()) as {
        status?: string;
        reason?: string;
        data?: {
          id?: string;
          name?: string;
          country?: string;
          dateOfBirth?: string;
          role?: string;
          battingStyle?: string;
          bowlingStyle?: string;
          placeOfBirth?: string;
          stats?: Array<{
            fn?: string;
            matchtype?: string;
            stat?: string;
            value?: string;
          }>;
        };
      };

      if (payload.status !== 'success' || !payload.data) {
        res.status(502).json({
          configured: true,
          profile: null,
          message: payload.reason || 'Player career details unavailable from Approved Cricket API.',
        });
        return;
      }

      const info = payload.data;
      const now = new Date().toISOString();
      const sourceLabel = 'Approved Cricket API (CricketData v1)';

      const buckets: Record<string, Record<string, unknown>> = {};
      const ensureBucket = (fmt: string) => {
        if (!buckets[fmt]) {
          buckets[fmt] = {
            formatKey: fmt,
            source: sourceLabel,
            lastUpdated: now,
            batting: {},
            bowling: {},
            fielding: {},
          };
        }
        return buckets[fmt];
      };

      for (const row of info.stats ?? []) {
        const fmt = row.matchtype ? mapApiMatchTypeToFormatKey(row.matchtype) : null;
        if (!fmt || !row.stat) continue;
        const bucket = ensureBucket(fmt);
        const fn = (row.fn || '').toLowerCase();
        const statKey = row.stat.trim().toLowerCase();
        const rawVal = row.value;

        if (fn === 'batting') {
          const bat = bucket.batting as Record<string, unknown>;
          if (statKey === 'm') bat.matches = parseNullableNumber(rawVal);
          else if (statKey === 'inn') bat.innings = parseNullableNumber(rawVal);
          else if (statKey === 'no') bat.notOuts = parseNullableNumber(rawVal);
          else if (statKey === 'runs') bat.runs = parseNullableNumber(rawVal);
          else if (statKey === 'hs') {
            bat.highestScore = parseNullableNumber(rawVal);
            bat.highestScoreIsNotOut = typeof rawVal === 'string' && rawVal.includes('*');
          } else if (statKey === 'avg') bat.average = parseNullableNumber(rawVal);
          else if (statKey === 'bf') bat.ballsFaced = parseNullableNumber(rawVal);
          else if (statKey === 'sr') bat.strikeRate = parseNullableNumber(rawVal);
          else if (statKey === '100s' || statKey === '100') bat.hundreds = parseNullableNumber(rawVal);
          else if (statKey === '200s' || statKey === '200') bat.doubleHundreds = parseNullableNumber(rawVal);
          else if (statKey === '50s' || statKey === '50') bat.fifties = parseNullableNumber(rawVal);
          else if (statKey === '4s') bat.fours = parseNullableNumber(rawVal);
          else if (statKey === '6s') bat.sixes = parseNullableNumber(rawVal);
          else if (statKey === 'ducks' || statKey === '0s') bat.ducks = parseNullableNumber(rawVal);
        } else if (fn === 'bowling') {
          const bowl = bucket.bowling as Record<string, unknown>;
          if (statKey === 'm') bowl.matches = parseNullableNumber(rawVal);
          else if (statKey === 'inn') bowl.innings = parseNullableNumber(rawVal);
          else if (statKey === 'b') bowl.balls = parseNullableNumber(rawVal);
          else if (statKey === 'runs') bowl.runsConceded = parseNullableNumber(rawVal);
          else if (statKey === 'wkts') bowl.wickets = parseNullableNumber(rawVal);
          else if (statKey === 'bbi') {
            const parsed = parseBowlingFigures(rawVal);
            if (parsed.display) {
              bowl.bestBowlingDisplay = parsed.display;
              bowl.bestBowlingWickets = parsed.wickets;
              bowl.bestBowlingRuns = parsed.runs;
            }
          } else if (statKey === 'econ') bowl.economy = parseNullableNumber(rawVal);
          else if (statKey === 'avg') bowl.average = parseNullableNumber(rawVal);
          else if (statKey === 'sr') bowl.strikeRate = parseNullableNumber(rawVal);
          else if (statKey === '4w') bowl.fourWickets = parseNullableNumber(rawVal);
          else if (statKey === '5w') bowl.fiveWickets = parseNullableNumber(rawVal);
          else if (statKey === '10w') bowl.tenWickets = parseNullableNumber(rawVal);
        } else if (fn === 'fielding') {
          const fld = bucket.fielding as Record<string, unknown>;
          if (statKey === 'catches' || statKey === 'ct') fld.catches = parseNullableNumber(rawVal);
          else if (statKey === 'stumpings' || statKey === 'st') fld.stumpings = parseNullableNumber(rawVal);
          else if (statKey === 'run outs' || statKey === 'ro') fld.runOuts = parseNullableNumber(rawVal);
        }
      }

      res.json({
        configured: true,
        source: sourceLabel,
        lastUpdated: now,
        profile: {
          externalId: info.id,
          name: info.name,
          country: info.country || undefined,
          dateOfBirth: info.dateOfBirth ? info.dateOfBirth.slice(0, 10) : undefined,
          roleText: info.role || undefined,
          battingStyleText: info.battingStyle || undefined,
          bowlingStyleText: info.bowlingStyle || undefined,
          formats: Object.values(buckets),
        },
        note: 'Only verified fields returned by the Approved Cricket API are populated; unavailable metrics remain Not Available.',
      });
    } catch (err) {
      res.status(502).json({
        configured: true,
        profile: null,
        message: err instanceof Error ? err.message : 'Failed to fetch player details from API.',
      });
    }
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Cricket Arena server running at http://0.0.0.0:${PORT}`);
  });
}

void startServer();
