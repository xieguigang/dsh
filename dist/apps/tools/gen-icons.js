// Generates assets/icons.js from the deduplicated icon manifest.
// Usage: node tools/gen-icons.js
const fs = require('fs');
const path = require('path');

const unique = JSON.parse(fs.readFileSync(path.join(__dirname, 'icons-unique.json'), 'utf8'));
const byId = new Map(unique.map((x) => [x.id, x]));

// semantic name -> manifest id
const MAP = {
  fish: 'ic000',
  wordmark: 'ic001',
  collapseSidebar: 'ic002',
  plusCircle: 'ic003',
  plugins: 'ic004',
  search: 'ic005',
  filter: 'ic006',
  addWorkspace: 'ic007',
  folder: 'ic008',
  chevronRight: 'ic009',
  dots: 'ic010',
  sessionIcon: 'ic011',
  archive: 'ic012',
  pin: 'ic013',
  folderClosed: 'ic014',
  chevronRightClosed: 'ic015',
  settings: 'ic016',
  panelRight: 'ic017',
  fishHero: 'ic018',
  folderChip: 'ic019',
  chevronDown12: 'ic020',
  mode: 'ic021',
  chevronDown14: 'ic022',
  plus: 'ic023',
  shieldWrite: 'ic024',
  chevronDownTiny: 'ic025',
  bolt: 'ic026',
  chevronDownModel: 'ic027',
  send: 'ic028',
  newTab: 'ic029',
  split: 'ic030',
  fullscreen: 'ic031',
  collapseRight: 'ic032',
  file: 'ic033',
  goal: 'ic034',
  plan: 'ic035',
  feedback: 'ic036',
  command: 'ic037',
  shieldRead: 'ic041',
  check: 'ic042',
  shieldFull: 'ic043',
  chevronDownOpen: 'ic044',
  chevronRight14: 'ic045',
  check16: 'ic046',
  rename: 'ic048',
  fork: 'ic049',
  navGeneral: 'ic050',
  navModels: 'ic051',
  navPlugins: 'ic052',
  navPresets: 'ic053',
  close: 'ic054',
  chevronRow: 'ic055',
  chevronLang: 'ic056',
  sun: 'ic057',
  moon: 'ic058',
  monitor: 'ic059',
  fontUp: 'ic060',
  fontDown: 'ic061',
  chevronWork: 'ic062',
  info: 'ic064',
  refresh: 'ic065',
  addPlugin: 'ic066',
  modeSmall: 'ic071',
  chevronDown10: 'ic072',
  copy: 'ic073',
  chevronPill: 'ic074',
  readFile: 'ic075',
  terminal: 'ic076',
  chevronTool: 'ic077',
  sparkle: 'ic078',
  todo: 'ic079',
  searchFiles: 'ic080',
  branch: 'ic081',
  code: 'ic082',
  link: 'ic083',
  filePreview: 'ic084',
  fileLocation: 'ic085',
  otherPreview: 'ic086',
  thumbUp: 'ic087',
  thumbDown: 'ic088',
  usage: 'ic089',
  sparkle2: 'ic090',
  wrap: 'ic091',
  copy14: 'ic092',
  chevronUp14: 'ic093',
  gauge: 'ic094',
  track: 'ic095',
  compass: 'ic096',
  compassBig: 'ic097',
  workspaceFiles: 'ic098',
  newTerminal: 'ic099',
};

// plugin icons delivered as base64 data URIs on the original page
const PLUGIN_B64 = {
  pluginAgentTeams:
    'PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTMuMzAyNyAxNy4xMDc3SDkuMDMxMjVWMTIuODM3MkgxMy4zMDI3VjE3LjEwNzdaTTE3LjU3NDIgMTIuODM3MkMxNy41NzQgMTUuMTk1OCAxNS42NjIzIDE3LjEwNzUgMTMuMzAzNyAxNy4xMDc3VjguNTY1NjdIMTcuNTc0MlYxMi44MzcyWiIgZmlsbD0idXJsKCNhKSIgLz4KICA8cGF0aCBkPSJNMTguNTIyOSAxMi44MzcyVjguNTY1NjdIMjIuNzk0NFYxMi44MzcySDI3LjA2NTlWMTcuMTA3N0gyMi43OTQ0QzIwLjQzNTcgMTcuMTA3NyAxOC41MjMyIDE1LjE5NTkgMTguNTIyOSAxMi44MzcyWiIgZmlsbD0iI0YyQUY2MyIgLz4KICA8cGF0aCBkPSJNMTcuNTc0MiAyNi42MDcySDEzLjMwMzdWMTguMDY0MkMxNS42NjI1IDE4LjA2NDQgMTcuNTc0MiAxOS45NzY5IDE3LjU3NDIgMjIuMzM1N1YyNi42MDcyWk0xMy4zMDI3IDIyLjMzNTdIOS4wMzEyNVYxOC4wNjQySDEzLjMwMjdWMjIuMzM1N1oiIGZpbGw9IiM3Q0I3RkYiIC8+CiAgPHBhdGggZD0iTTIyLjc5NDQgMjYuNjA3MkgxOC41MjI5VjIyLjMzNTdDMTguNTIyOSAxOS45NzY4IDIwLjQzNTUgMTguMDY0MiAyMi43OTQ0IDE4LjA2NDJIMjcuMDY1OVYyMi4zMzU3SDIyLjc5NDRWMjYuNjA3MloiIGZpbGw9IiM0NUQ5RTciIC8+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIxNi4xMjQ3IiB5MT0iNi42NjEzIiB4Mj0iOS4wMzEyNSIgeTI9IjE5LjIyMDYiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iIzdDQjdGRiIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMTQ1QUYzIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=',
  pluginAutoReview:
    'PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxLjUgMS41KSBzY2FsZSgwLjkxNjY2NjY2NjcpIj4KICAgIDxwYXRoIGQ9Ik0xOCA2TDI4LjUgOS41VjE3LjJDMjguNSAyMy4xIDI0LjA4IDI4LjQgMTggMzBDMTEuOTIgMjguNCA3LjUgMjMuMSA3LjUgMTcuMlY5LjVMMTggNloiIGZpbGw9InVybCgjYSkiIGZpbGwtb3BhY2l0eT0iMC44IiAvPgogICAgPHBhdGggZD0iTTE0LjIgMThMMTYuODQgMjAuNjNMMjIuMiAxNS4yNyIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjIuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiAvPgogIDwvZz4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYSIgeDE9IjE4IiB5MT0iNiIgeDI9IjE4IiB5Mj0iMzAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iIzdBQzJGRiIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNEE2NUU4IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPgo=',
  pluginAutomation:
    'PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjU0MDQgMTcuOTE0M0wyMi4yNTI2IDE5LjM4ODVMMjEuNTk5OCAyMS4wMzMyTDE3Ljg4NzUgMTkuNTZDMTcuMjEzNCAxOS4yOTI0IDE2Ljc3MSAxOC42Mzk4IDE2Ljc3MSAxNy45MTQzVjEzLjYzOTlIMTguNTQwNFYxNy45MTQzWiIgZmlsbD0idXJsKCNwYWludDBfbGluZWFyXzM3ODZfOTY0NjEpIiBzdHJva2U9InVybCgjcGFpbnQxX2xpbmVhcl8zNzg2Xzk2NDYxKSIgc3Ryb2tlLXdpZHRoPSIwLjI4NDM1MiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNMTcuOTk3NiA4QzIxLjQ1MTUgOCAyNC40OTY4IDkuNzUxMjcgMjYuMjkzNSAxMi40MTQxTDI2LjY0NiAxMC45MTg5TDI4LjEyMTYgMTEuMjY2NkwyNy4yNjcxIDE0LjkwMzNMMjcuMTExOCAxNS41NjI1TDI2LjQzOSAxNS40ODI0TDIyLjczIDE1LjA0MkwyMi45MDc3IDEzLjUzNzFMMjQuNjcxNCAxMy43NDUxQzIzLjI2NTUgMTEuNTQ1IDIwLjgwMTkgMTAuMDg1OSAxNy45OTc2IDEwLjA4NTlDMTMuNjI2OCAxMC4wODYyIDEwLjA4MzYgMTMuNjI5MiAxMC4wODM1IDE4QzEwLjA4MzYgMjIuMzcwOCAxMy42MjY4IDI1LjkxNDggMTcuOTk3NiAyNS45MTVDMjIuMzY4NSAyNS45MTUgMjUuOTEyNSAyMi4zNzA5IDI1LjkxMjYgMThWMTcuOTUzMUgyNy45OTc2VjE4QzI3Ljk5NzQgMjMuNTIyNiAyMy41MjAyIDI4IDE3Ljk5NzYgMjhDMTIuNDc1MiAyNy45OTk4IDcuOTk3NjggMjMuNTIyNCA3Ljk5NzU2IDE4QzcuOTk3NjQgMTIuNDc3NSAxMi40NzUxIDguMDAwMjQgMTcuOTk3NiA4Wk0xNC4xMjM1IDI3LjE2OTlDMTQuMTY1NyAyNy4xODc3IDE0LjIwOTEgMjcuMjAyNSAxNC4yNTE1IDI3LjIxOTdDMTQuMTY4MyAyNy4xODU5IDE0LjA4NTcgMjcuMTUwNyAxNC4wMDM0IDI3LjExNTJMMTQuMTIzNSAyNy4xNjk5WiIgZmlsbD0idXJsKCNwYWludDJfbGluZWFyXzM3ODZfOTY0NjEpIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMzc4Nl85NjQ2MSIgeDE9IjE1LjYzMzQiIHkxMT0iMTMuMjYwNyIgeDI9IjI5LjkwOTIiIHkyPSIyNy4zNjk2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzU4QkNDOCIvPjxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iIzY1OEVGRiIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJwYWludDFfbGluZWFyXzM3ODZfOTY0NjEiIHgxPSIxNi41ODEyIiB5MT0iMTMuMjYwNyIgeDI9IjI5LjkwOTIiIHkyPSIyNy4zNjk2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzU4QkNDOCIvPjxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iIzY1OEVGRiIvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSJwYWludDJfbGluZWFyXzM3ODZfOTY0NjEiIHgxPSIxMy4yMTg0IiB5MT0iNy41MjM4MSIgeDI9IjMxLjAxOTQiIHkyPSIyNy4yMjQ1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzUyQ0VEOCIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzYxN0JFQiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPgo=',
  pluginVoice:
    'PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMjMuNzMyNCA4Ljc3MTQ4VjI3LjIyOTVMMjEuMjMyNCAyNy4yMjg1VjguNzcwNTFMMjMuNzMyNCA4Ljc3MTQ4Wk0xNC42Nzk3IDEwLjc3MTVMMTQuNjc4NyAyNS4yMjk1TDEyLjE3ODcgMjUuMjI4NUwxMi4xNzk3IDEwLjc3MDVMMTQuNjc5NyAxMC43NzE1Wk0xOS4zOTI2IDIyLjQxMzFIMTYuODkyNlYxMy41ODU5SDE5LjM5MjZWMjIuNDEzMVpNMTAuMDYyNSAyMC43MDhINy41NjI1VjE1LjI5MUgxMC4wNjI1VjIwLjcwOFpNMjguNDM3NSAyMC43MDhIMjUuOTM3NVYxNS4yOTFIMjguNDM3NVYyMC43MDhaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMzM3MV84NTIwMykiIC8+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMzM3MV84NTIwMyIgeDE9IjguMjQ2MDIiIHkxMT0iMTYuNDA4MyIgeDI9IjMyLjU2MTEiIHkyPSIyMi45Njk5IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agc3RvcC1jb2xvcj0iIzY3QzdGRSIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzNGNzdEOCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPgo=',
};

const PLUGIN_INLINE = {
  pluginShell:
    '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 11L16.606 17.606C16.6841 17.6841 16.6841 17.8107 16.606 17.8888L10 24.4948" stroke="#679EFE" stroke-width="3.5"></path><path d="M20.1211 24.4946H26.8685" stroke="#679EFE" stroke-width="3.5"></path></svg>',
  pluginAgentLoop:
    '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.0486 28.4901C12.0858 28.4901 7.25195 23.6562 7.25195 17.6934C13.2148 17.6934 18.0486 22.5272 18.0486 28.4901Z" fill="#A797FC"></path><path d="M18.0486 6.89667C12.0858 6.89667 7.25195 11.7305 7.25195 17.6934C13.2148 17.6934 18.0486 12.8595 18.0486 6.89667Z" fill="url(#dsh_plugin_art_r4ma)"></path><path d="M18.0485 28.4901C24.0114 28.4901 28.8452 23.6562 28.8452 17.6934C22.8824 17.6934 18.0485 22.5272 18.0485 28.4901Z" fill="#4561EE"></path><path d="M18.0485 6.89667C24.0114 6.89667 28.8452 11.7305 7.25195 17.6934C22.8824 17.6934 18.0485 12.8595 18.0485 6.89667Z" fill="#658EFF"></path><defs><linearGradient id="dsh_plugin_art_r4ma" x1="16.7911" y1="16.1655" x2="8.98192" y2="8.74289" gradientUnits="userSpaceOnUse"><stop stop-color="#A23AE7"></stop><stop offset="1" stop-color="#E2E2E2"></stop></linearGradient></defs></svg>',
  pluginSubagent:
    '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14.9893" y="15.1877" width="12.2365" height="12.2365" rx="2" fill="url(#dsh_plugin_art_r4oa)" fill-opacity="0.8"></rect><rect x="8.87109" y="9.0697" width="12.2365" height="12.2365" rx="2" fill="url(#dsh_plugin_art_r4ob)" fill-opacity="0.8"></rect><defs><linearGradient id="dsh_plugin_art_r4oa" x1="21.1075" y1="15.1877" x2="21.1075" y2="27.4243" gradientUnits="userSpaceOnUse"><stop stop-color="#45E7A4"></stop><stop offset="1" stop-color="#05909D"></stop></linearGradient><linearGradient id="dsh_plugin_art_r4ob" x1="14.9894" y1="9.0697" x2="14.9894" y2="21.3063" gradientUnits="userSpaceOnUse"><stop stop-color="#69B9FF"></stop><stop offset="1" stop-color="#324DE2"></stop></linearGradient></defs></svg>',
  pluginWebSearch:
    '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M26.5362 26.9865L22.3813 22.8317" stroke="#658EFF" stroke-width="3"></path><g clip-path="url(#dsh_plugin_art_r4rring)"><g transform="matrix(0.0119394 -0.00173904 0.00173904 0.0119394 15.7661 16.2159)"><foreignObject x="-958.94" y="-958.94" width="1917.88" height="1917.88"><div style="background: conic-gradient(from 90deg, rgb(65, 225, 172) 0deg, rgb(101, 142, 255) 62.0619deg, rgb(65, 225, 172) 360deg); height: 100%; width: 100%;"></div></foreignObject></g></g><defs><clipPath id="dsh_plugin_art_r4rring"><path d="M21.9717 16.2159H19.9717C19.9717 18.5386 18.0888 20.4215 15.7661 20.4215V22.4215V24.4215C20.2979 24.4215 23.9717 20.7478 23.9717 16.2159H21.9717ZM15.7661 22.4215V20.4215C13.4434 20.4215 11.5605 18.5386 11.5605 16.2159H9.56055H7.56055C7.56055 20.7478 11.2343 24.4215 15.7661 24.4215V22.4215ZM9.56055 16.2159H11.5605C11.5605 13.8933 13.4434 12.0104 15.7661 12.0104V10.0104V8.01038C11.2343 8.01038 7.56055 11.6841 7.56055 16.2159H9.56055ZM15.7661 10.0104V12.0104C18.0888 12.0104 19.9717 13.8933 19.9717 16.2159H21.9717H23.9717C23.9717 11.6841 20.2979 8.01038 15.7661 8.01038V10.0104Z"></path></clipPath></defs></svg>',
};

const extra = { ...Object.fromEntries(Object.entries(PLUGIN_B64).map(([k, v]) => [k, Buffer.from(v, 'base64').toString('utf8')])), ...PLUGIN_INLINE };

const ICONS = {};
const DIMS = {};
for (const [name, id] of Object.entries(MAP)) {
  const item = byId.get(id);
  if (!item) {
    console.error('missing icon', name, id);
    process.exit(1);
  }
  let html = item.html.replace(/\s(width|height)="[^"]*"/g, '');
  ICONS[name] = html;
  DIMS[name] = { w: parseFloat(item.w) || 16, h: parseFloat((item.vb.split(' ')[3])) || 16 };
}
for (const [name, html] of Object.entries(extra)) {
  ICONS[name] = html.replace(/\s(width|height)="[^"]*"/g, '');
  DIMS[name] = { w: 36, h: 36 };
}
// stop button (generation in progress) — solid rounded square
ICONS.stop = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.6" fill="currentColor"></rect></svg>';
DIMS.stop = { w: 16, h: 16 };
// deep-diving indicator (paper plane)
ICONS.deepDive =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M14.5 1.5L7.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path><path d="M14.5 1.5L9.8 14.2L7.5 8.5L1.2 6.2L14.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"></path></svg>';
DIMS.deepDive = { w: 14, h: 14 };

// --- phase-2 additions (file viewer / stats panels / trajectory) ---
// open folder (expanded workspace folder)
ICONS.folderOpen =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-width="1"><path d="M2.55912 7.93683C2.67584 7.49906 3.0723 7.19446 3.52536 7.19446H13.6491C14.3061 7.19446 14.7846 7.81725 14.6153 8.45209L13.4411 12.856C13.3244 13.2938 12.9279 13.5984 12.4748 13.5984H2.35113C1.69411 13.5984 1.21562 12.9756 1.38489 12.3407L2.55912 7.93683Z" fill="currentColor" opacity="0.16"></path><path d="M13.6491 6.69446C14.6346 6.69453 15.3522 7.62895 15.0983 8.58118L13.9245 12.9845C13.7494 13.6412 13.1539 14.0988 12.4743 14.0988H2.35126C1.36574 14.0988 0.648153 13.1643 0.902044 12.212L2.07587 7.80774C2.25102 7.15128 2.84567 6.69455 3.52509 6.6945L3.5 3.61059C3.5 3.05831 3.95211 2.6106 4.50439 2.6106H6.43389C6.67773 2.6106 6.91318 2.69969 7.09593 2.86113L8.71649 4.29265C8.89924 4.45409 9.1347 4.54319 9.3785 4.54319H13.4958C14.0481 4.54319 14.4958 4.9909 14.4958 5.54319V6.69446Z" stroke="currentColor"></path></svg>';
DIMS.folderOpen = { w: 16, h: 16 };
// clock (duration toggle)
ICONS.clock =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-width="1"><circle cx="8" cy="8" r="5.25" stroke="currentColor"></circle><path d="M8 4.75V8l2.25 1.5" stroke="currentColor" stroke-linecap="round"></path></svg>';
DIMS.clock = { w: 12, h: 12 };
// database (token usage pill)
ICONS.database =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-width="1"><path d="M13.1967 5.1869C13.7232 4.77378 14.0003 4.30517 14.0001 3.82819C14.0003 3.3512 13.7232 2.88259 13.1967 2.46947C12.6702 2.05635 11.9128 1.71328 11.0006 1.47475C10.0885 1.23621 9.05371 1.11062 8.00039 1.1106C6.94707 1.11057 5.9123 1.23612 5.00009 1.47461C4.08742 1.71301 3.32948 2.05604 2.80249 2.46919C2.2755 2.88235 1.99805 3.35106 1.99805 3.82819C1.99805 4.30531 2.2755 4.77402 2.80249 5.18718C3.32948 5.60033 4.08742 5.94336 5.00009 6.18176C5.9123 6.42025 6.94707 6.5458 8.00039 6.54578C9.05371 6.54575 10.0885 6.42016 11.0006 6.18163C11.9128 5.94309 12.6702 5.60002 13.1967 5.1869Z" stroke="currentColor"></path><path d="M2 3.80371V11.7848" stroke="currentColor"></path><path d="M14 3.80371V11.7848" stroke="currentColor"></path><path d="M2 7.81396C2 8.60524 2.63214 9.36411 3.75736 9.92363C4.88258 10.4832 6.4087 10.7975 8 10.7975C9.5913 10.7975 11.1174 10.4832 12.2426 9.92363C13.3679 9.36411 14 8.60524 14 7.81396" stroke="currentColor"></path><path d="M2 11.7847C2 12.6081 2.63214 13.3977 3.75736 13.98C4.88258 14.5622 6.4087 14.8893 8 14.8893C9.5913 14.8893 11.1174 14.5622 12.2426 13.98C13.3679 13.3977 14 12.6081 14 11.7847" stroke="currentColor"></path></svg>';
DIMS.database = { w: 14, h: 14 };
// read again (reload file)
ICONS.readAgain =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-width="1"><path d="M14.5001 8C14.5 9.28552 14.1188 10.5422 13.4045 11.611C12.6903 12.6799 11.6752 13.5129 10.4875 14.0049C9.29982 14.4968 7.99295 14.6255 6.73212 14.3747C5.4713 14.124 4.31314 13.505 3.4041 12.596C2.49514 11.687 1.87614 10.5288 1.62537 9.26798C1.37459 8.00716 1.50331 6.70028 1.99525 5.51261C2.48719 4.32494 3.32025 3.30981 4.3891 2.59557C5.45795 1.88134 6.71458 1.50008 8.0001 1.5" stroke="currentColor"></path><path d="M11.5 8C11.5001 8.69227 11.2948 9.36901 10.9102 9.94463C10.5257 10.5202 9.97901 10.9689 9.33944 11.2338C8.69986 11.4987 7.99609 11.5681 7.31712 11.433C6.63816 11.2979 6.01449 10.9645 5.52501 10.475C5.03548 9.98552 4.70209 9.36185 4.56702 8.68289C4.43195 8.00392 4.50127 7.30015 4.76619 6.66057C5.03112 6.021 5.47976 5.47436 6.05538 5.08978C6.631 4.70519 7.30774 4.49995 8.00001 4.5" stroke="currentColor"></path><path d="M8.00024 7.99976L11.2 4.80005" stroke="currentColor"></path></svg>';
DIMS.readAgain = { w: 14, h: 14 };
// edit (activity group icon)
ICONS.editTool =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-width="1"><path d="M11.3318 2.10075C11.7224 1.71023 12.3555 1.71023 12.7461 2.10075L13.4532 2.80786C13.8437 3.19838 13.8437 3.83155 13.4532 4.22207L6.0002 11.6751L2.61035 12.3365L3.27179 8.94668L11.3318 2.10075Z" stroke="currentColor" stroke-linejoin="round"></path></svg>';
DIMS.editTool = { w: 14, h: 14 };
// code file (tree rows for source files)
ICONS.codeFile =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-width="1"><path d="M4.5 6.5L2.5 8.5L4.5 10.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M11.5 6.5L13.5 8.5L11.5 10.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9.25 4.5L6.75 12.5" stroke="currentColor" stroke-linecap="round"></path></svg>';
DIMS.codeFile = { w: 16, h: 16 };

const out = `// Auto-generated from the original DeepSeek Harness page (tools/gen-icons.js). Do not edit by hand.
window.ICON_DIMS = ${JSON.stringify(DIMS)};
window.ICONS = ${JSON.stringify(ICONS)};
window.icon = function (name, size) {
  const raw = window.ICONS[name];
  if (!raw) return '';
  const d = window.ICON_DIMS[name] || { w: 16, h: 16 };
  const w = (size && size.w) || d.w;
  const h = (size && size.h) || d.h;
  return raw.replace('<svg', '<svg width="' + w + '" height="' + h + '"');
};
`;
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icons.js'), out);
console.log('icons written:', Object.keys(ICONS).length);
