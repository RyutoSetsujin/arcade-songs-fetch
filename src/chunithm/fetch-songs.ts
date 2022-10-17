import axios from 'axios';
import log4js from 'log4js';
import { hashed, ensureNoDuplicateEntry } from '@/_core/utils';
import { Song, SongOrder, Sheet, JpSheet } from '@@/db/chunithm/models';

const logger = log4js.getLogger('chunithm/fetch-songs');
logger.level = log4js.levels.INFO;

const DATA_URL = 'https://chunithm.sega.jp/storage/json/music.json';
const IMAGE_BASE_URL = 'https://new.chunithm-net.com/chuni-mobile/html/mobile/img/';

function getSongId(rawSong: Record<string, any>): string {
  if (rawSong.catname === 'WORLD\'S END') {
    //! hotfix
    if (rawSong.title === 'G e n g a o z o') {
      if (rawSong.id === '8108') return '(WE) G e n g a o z o';
      if (rawSong.id === '8203') return '(WE) G e n g a o z o (2)';
    }
    if (rawSong.title === 'Aragami') {
      if (rawSong.id === '8164') return '(WE) Aragami';
      if (rawSong.id === '8241') return '(WE) Aragami (2)';
    }
    if (rawSong.title === 'Random') {
      if (rawSong.id === '8244') return '(WE) Random';
      if (rawSong.id === '8245') return '(WE) Random (2)';
      if (rawSong.id === '8246') return '(WE) Random (3)';
      if (rawSong.id === '8247') return '(WE) Random (4)';
      if (rawSong.id === '8248') return '(WE) Random (5)';
      if (rawSong.id === '8249') return '(WE) Random (6)';
    }
    return `(WE) ${rawSong.title}`;
  }
  //! hotfix
  if (rawSong.title === 'Reach for the Stars') return 'Reach For The Stars';
  if (rawSong.title === 'まっすぐ→→→ストリーム!') return 'まっすぐ→→→ストリーム！';
  return rawSong.title;
}

function preprocessRawSongs(rawSongs: Record<string, any>[]) {
  for (const rawSong of rawSongs) {
    if (rawSong.we_kanji) {
      rawSong.catname = 'WORLD\'S END';
    }
  }
}

function extractSong(rawSong: Record<string, any>) {
  const imageUrl = new URL(rawSong.image, IMAGE_BASE_URL).toString();
  const imageName = `${hashed(imageUrl)}.png`;

  return {
    songId: getSongId(rawSong),

    category: rawSong.catname,
    title: rawSong.title,
    artist: rawSong.artist,

    imageName,
    imageUrl,

    version: null,
    releaseDate: null,
    sortOrder: Number(rawSong.id) < 8000 ? Number(rawSong.id) : Number(rawSong.id) - 10000,

    isNew: !!Number(rawSong.newflag),
    isLocked: null,
  };
}

function extractSheets(rawSong: Record<string, any>) {
  return [
    { type: 'std', difficulty: 'basic', level: rawSong.lev_bas },
    { type: 'std', difficulty: 'advanced', level: rawSong.lev_adv },
    { type: 'std', difficulty: 'expert', level: rawSong.lev_exp },
    { type: 'std', difficulty: 'master', level: rawSong.lev_mas },
    { type: 'std', difficulty: 'ultima', level: rawSong.lev_ult },
    {
      type: 'we',
      difficulty: rawSong.we_kanji !== '' ? `【${rawSong.we_kanji}】` : null,
      level: rawSong.we_star !== '' ? '☆'.repeat((Number(rawSong.we_star) + 1) / 2) : null,
    },
  ].filter((e) => !!e.level).map((rawSheet) => ({
    songId: getSongId(rawSong),
    ...rawSheet,
  }));
}

export default async function run() {
  logger.info(`Fetching data from: ${DATA_URL} ...`);
  const response = await axios.get(DATA_URL);

  const rawSongs: Record<string, any>[] = response.data;
  rawSongs.sort((a, b) => Number(a.id) - Number(b.id));
  preprocessRawSongs(rawSongs);
  logger.info(`OK, ${rawSongs.length} songs fetched.`);

  logger.info('Ensuring every song has an unique songId ...');
  ensureNoDuplicateEntry(rawSongs.map((rawSong) => getSongId(rawSong)));

  const songs = rawSongs.map((rawSong) => extractSong(rawSong));
  const sheets = rawSongs.flatMap((rawSong) => extractSheets(rawSong));

  logger.info('Updating songs ...');
  await Promise.all(songs.map((song) => Song.upsert(song)));
  await SongOrder.truncate();
  await Promise.all(songs.map((song) => SongOrder.upsert(song)));

  logger.info('Updating sheets ...');
  await Promise.all(sheets.map((sheet) => Sheet.upsert(sheet)));

  logger.info('Truncating and Inserting jpSheets ...');
  await JpSheet.truncate();
  await JpSheet.bulkCreate(sheets);

  logger.info('Done!');
}

if (require.main === module) run();
