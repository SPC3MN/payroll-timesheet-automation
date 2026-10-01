#!/usr/bin/env node
/**
 * Builds one client list (CSV) from the payroll staff's weekly tracking workbooks, ready to
 * import into the SharePoint `Clients` list.
 *
 *   node tools/import-clients.js
 *
 * Reads (all in the gitignored local/ folder; the repo is public, so client and company names
 * never leave it):
 *   local/sources.json                 which workbooks to read, one per company name, e.g.
 *                                      [{ "company": "Example Co", "file": "Example.xlsx",
 *                                         "active": "Current", "inactive": "Inactive" }]
 *                                      ("inactive" is optional)
 *   local/<file>.xlsx                  the workbooks named in sources.json
 *   local/client-steps.json            optional: client-specific checklist steps, e.g.
 *                                      { "EXAMPLE CLIENT A": ["ACH", "SendPreviewForApproval"] }
 *                                      (key = start of the client name, case-insensitive)
 * Writes:
 *   local/clients.csv
 *
 * Workbook layout (one row per client, from row 4 or 5): A frequency, B timecards in,
 * C phone, D "CLIENT NAME (contact)", E additional payroll report / how it's delivered,
 * F payroll done, G billing done, H and I notes. No dependencies: Node 18+ only.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LOCAL = path.join(__dirname, '..', 'local');
const STEPS = ['ACH', 'JobCostReport', 'Report', 'SendPreviewForApproval', 'SendForApproval', 'CouncilOnAgingReport'];
const HEADER = ['Company', 'ClientName', 'Contact', 'Phone', 'Frequency', 'FrequencyAsWritten',
  'ReportDelivery', 'ReportDeliveryAsWritten', ...STEPS, 'StandingNotes', 'Active', 'SourceSheet'];

// ---------------------------------------------------------------------------
// .xlsx reading (a zip of XML files)
// ---------------------------------------------------------------------------

function unzip(file) {
  const buf = fs.readFileSync(file);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    entries[name] = () => (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
const xmlText = xml => decode([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));

/** { sheetName: [{ row, A: '...', B: '...' }, ...] } */
function readWorkbook(file) {
  const zip = unzip(file);
  const read = name => (zip[name] ? zip[name]() : '');
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlText(m[1]));
  const rels = Object.fromEntries([...read('xl/_rels/workbook.xml.rels')
      .matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(m => [m[1], m[2]]));
  const sheets = {};
  for (const [, name, rid] of read('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const xml = read('xl/' + rels[rid].replace(/^\/?xl\//, ''));
    sheets[decode(name)] = [...xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(([, row, cells]) => {
      const out = { row: +row };
      for (const c of cells.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const col = /r="([A-Z]+)\d+"/.exec(c[1])[1];
        const type = (/t="(\w+)"/.exec(c[1]) || [])[1];
        const v = (/<v>([\s\S]*?)<\/v>/.exec(c[2] || '') || [])[1];
        const value = type === 's' ? shared[+v] : type === 'inlineStr' ? xmlText(c[2]) : v != null ? decode(v) : '';
        if (value && value.trim()) out[col] = value.trim();
      }
      return out;
    });
  }
  return sheets;
}

// ---------------------------------------------------------------------------
// Normalising the staff's free-text columns
// ---------------------------------------------------------------------------

/** "ACME LLC (Pat)" → ['ACME LLC', 'Pat']; "(formerly X)" stays part of the name. */
function splitName(raw) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(raw);
  if (!m || /^formerly\b/i.test(m[2].trim())) return [raw.trim(), ''];
  return [m[1].replace(/[\s-]+$/, '').trim(), m[2].trim()];
}

/** "Bi-Weekly & Mo - 5th" → "Biweekly;Monthly". Several schedules are joined with ";". */
function frequency(raw) {
  let s = raw.toLowerCase();
  const found = [];
  const take = (re, label) => { if (re.test(s)) { found.push(label); s = s.replace(re, ' '); } };
  take(/semi[-\s]?mo\w*\.?/g, 'Semi-monthly');
  take(/bi[-\s]?w\w*/g, 'Biweekly');
  take(/\bw(ee)?k\w*/g, 'Weekly');
  take(/\b(mo|mnth|month)\w*\.?|\b(1st|2nd|3rd|4th)\s+friday/g, 'Monthly');
  take(/\bq(u|tr)\w*\.?/g, 'Quarterly');
  return found.length ? found.join(';') : (raw ? 'Other' : '');
}

/** Column E → how the payroll report / invoice goes out. */
function delivery(raw) {
  const s = raw.toLowerCase();
  if (!s || /^(n\/a|x+)$/.test(s)) return 'None';
  const found = [];
  if (/extreme/.test(s)) found.push('Email from Extreme');
  else if (/e-?\s?mail/.test(s)) found.push('Email');
  if (/(^|[^e-])\bmail\b/.test(s.replace(/e-?\s?mail/g, ''))) found.push('Mail');
  if (/paper|print|deliver/.test(s)) found.push('Paper');
  return found.length ? found.join(';') : 'See notes';
}

function loadSources() {
  const file = path.join(LOCAL, 'sources.json');
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}: list the workbooks to read (see the header of this script).`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadSteps() {
  const file = path.join(LOCAL, 'client-steps.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function stepsFor(name, stepMap, used) {
  const key = Object.keys(stepMap).find(k => name.toUpperCase().startsWith(k.toUpperCase()));
  if (!key) return [];
  used.add(key);
  return stepMap[key];
}

// ---------------------------------------------------------------------------

function clientRows(source, sheetName, active, stepMap, used) {
  const sheets = readWorkbook(path.join(LOCAL, source.file));
  const rows = sheets[sheetName];
  if (!rows) throw new Error(`${source.file}: no sheet named "${sheetName}"`);
  return rows
      .filter(r => r.D && !/^company name$/i.test(r.D) && !/dates:/i.test(r.A || ''))
      .map(r => {
        const [name, contact] = splitName(r.D);
        const steps = stepsFor(name, stepMap, used);
        const unknown = steps.filter(s => !STEPS.includes(s));
        if (unknown.length) throw new Error(`client-steps.json: unknown step(s) ${unknown.join(', ')} for ${name}`);
        return {
          Company: source.company, ClientName: name, Contact: contact, Phone: r.C || '',
          Frequency: frequency(r.A || ''), FrequencyAsWritten: r.A || '',
          ReportDelivery: delivery(r.E || ''), ReportDeliveryAsWritten: r.E || '',
          ...Object.fromEntries(STEPS.map(s => [s, steps.includes(s) ? 'Yes' : 'No'])),
          StandingNotes: [r.H, r.I].filter(Boolean).join('\n\n'),
          Active: active ? 'Yes' : 'No', SourceSheet: `${source.file} › ${sheetName} › row ${r.row}`,
        };
      });
}

function csvCell(value) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet apps treating text as a formula
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const sources = loadSources();
  const stepMap = loadSteps();
  const used = new Set();
  const clients = [];
  for (const source of sources) {
    const active = clientRows(source, source.active, true, stepMap, used);
    // A client listed as current wins over an older "Inactive" row with the same name.
    const current = new Set(active.map(c => c.ClientName.toUpperCase()));
    const inactive = (source.inactive ? clientRows(source, source.inactive, false, stepMap, used) : [])
        .filter(c => !current.has(c.ClientName.toUpperCase()));
    clients.push(...active, ...inactive);
  }

  const out = path.join(LOCAL, 'clients.csv');
  const lines = [HEADER, ...clients.map(c => HEADER.map(h => c[h]))].map(r => r.map(csvCell).join(','));
  fs.writeFileSync(out, '﻿' + lines.join('\r\n') + '\r\n'); // BOM so Excel reads UTF-8

  const count = (company, active) => clients.filter(c => c.Company === company && c.Active === active).length;
  for (const { company } of sources) {
    console.log(`${company}: ${count(company, 'Yes')} active, ${count(company, 'No')} inactive`);
  }
  const other = clients.filter(c => c.Frequency === 'Other' || !c.Frequency);
  if (other.length) console.log(`Frequency not recognised (check by hand): ${other.map(c => c.ClientName).join('; ')}`);
  const unused = Object.keys(stepMap).filter(k => !used.has(k));
  if (unused.length) console.log(`client-steps.json keys that matched no client: ${unused.join('; ')}`);
  console.log(`Wrote ${out}`);
}

main();
