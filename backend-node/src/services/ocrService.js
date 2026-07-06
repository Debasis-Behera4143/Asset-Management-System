const Tesseract = require('tesseract.js');
const { createWorker } = Tesseract;
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');

/**
 * OCR Service.
 * Extracts structured invoice data from uploaded image/PDF files.
 *
 * NOTE: PDF support requires pdf-poppler or poppler-utils installed.
 * For production, consider using pdf2pic or pdfjs-dist for PDF rendering.
 */

// ─── Date Pattern Helpers ─────────────────────────────────────────────────────

const DATE_PATTERNS = [
  /(\d{2})\/(\d{2})\/(\d{4})/, // dd/MM/yyyy or MM/dd/yyyy
  /(\d{4})-(\d{2})-(\d{2})/,  // yyyy-MM-dd (ISO)
  /(\d{2})-(\d{2})-(\d{4})/,  // dd-MM-yyyy
  /(\w+ \d{1,2},? \d{4})/,    // "June 5, 2026"
  /(\d{1,2} \w+ \d{4})/,      // "5 June 2026"
];

// ─── Main OCR Entry Point ─────────────────────────────────────────────────────

/**
 * Extract invoice data from an uploaded file (buffer).
 */
async function extractInvoiceData(file) {
  const { buffer, mimetype, originalname } = file;

  logger.info(`OCR processing file: ${originalname} (${mimetype})`);

  let rawText;

  try {
    if (mimetype === 'application/pdf') {
      rawText = await extractFromPdf(buffer);
    } else {
      rawText = await extractFromImage(buffer, mimetype);
    }
  } catch (err) {
    logger.warn(`OCR extraction failed: ${err.message}. Using empty text.`);
    rawText = '';
  }

  logger.debug(`OCR raw text extracted (${rawText.length} chars)`);

  // Try AI parsing first if provider is configured
  let parsed = await parseOcrWithAi(rawText);
  if (parsed) {
    parsed.rawText = rawText;
    parsed.extractionConfidence = calculateConfidence(parsed);
    return parsed;
  }

  // Otherwise, use tightened regex fallback
  return parseInvoiceData(rawText);
}

// ─── Image Extraction ─────────────────────────────────────────────────────────

async function extractFromImage(buffer, mimetype) {
  // Write buffer to temp file
  const ext = mimeToExt(mimetype);
  const tmpFile = path.join(os.tmpdir(), `ocr_${Date.now()}${ext}`);

  try {
    fs.writeFileSync(tmpFile, buffer);
    const worker = await createWorker('eng', 1, {
      logger: m => logger.debug(`Tesseract: ${m.status} ${Math.round((m.progress || 0) * 100)}%`),
    });
    const { data: { text } } = await worker.recognize(tmpFile);
    await worker.terminate();
    return text;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

async function extractFromPdf(buffer) {
  try {
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    if (data && data.text && data.text.trim().length > 10) {
      logger.info('Digital PDF detected. Extracted text natively via pdf-parse.');
      return data.text;
    }
    logger.info('Digital PDF text extraction was empty. Falling back to Tesseract OCR.');
  } catch (err) {
    logger.warn(`pdf-parse failed: ${err.message}. Falling back to Tesseract OCR.`);
  }

  try {
    const worker = await createWorker('eng', 1, {
      logger: m => logger.debug(`Tesseract: ${m.status}`),
    });
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text;
  } catch (err) {
    logger.warn(`PDF OCR via Tesseract failed: ${err.message}.`);
    return '';
  }
}

// ─── Data Parsing ─────────────────────────────────────────────────────────────

async function parseOcrWithAi(text) {
  if (!text || text.trim() === '') return null;

  const config = require('../config/env');
  const apiKey = config.gemini.apiKey;
  const providerType = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  
  const isPlaceholder = !apiKey 
    || apiKey === 'your-gemini-api-key' 
    || apiKey === 'your_gemini_api_key_here'
    || apiKey === 'your-openai-api-key'
    || apiKey === '';

  const hasValidPrefix = providerType === 'openai'
    ? (apiKey && apiKey.startsWith('sk-'))
    : (apiKey && (apiKey.startsWith('AIza') || apiKey.startsWith('AQ')));

  if (isPlaceholder || !hasValidPrefix) {
    logger.info('AI provider not configured for OCR parsing. Using regex fallback.');
    return null;
  }

  try {
    const provider = require('./ai/index').getProvider();
    const systemPrompt = `You are an extremely strict AI data extractor specializing in parsing raw OCR text from purchase invoices.
Extract the fields below from the provided raw OCR text. Format the output as a clean, raw JSON object ONLY, with no markdown styling (do not use \`\`\`json block wrappers) or explanations.

CRITICAL INSTRUCTIONS:
1. ABSOLUTELY NO HALLUCINATIONS: If a field is not explicitly mentioned or clearly identifiable in the OCR text, you MUST return null for that field. Never guess, assume, interpolate, or generate fake values (like fake serial numbers, dates, or names).
2. NO INVENTING DETAILS: For example, do not generate a serial number or invoice number unless it is explicitly written next to identifiers like "S/N", "Serial", "Inv No", etc.
3. ACCURACY: The vendorName must be the actual name of the selling company. The totalAmount must be the final grand total of the invoice.

JSON Schema:
{
  "vendorName": "Exact supplier/vendor company name, or null if not found",
  "invoiceNumber": "Exact invoice number/id, or null if not found",
  "invoiceDate": "Invoice date strictly formatted as YYYY-MM-DD, or null if not found",
  "purchaseDate": "Purchase/Order date strictly formatted as YYYY-MM-DD, or null if not found",
  "totalAmount": 1234.56 (number representing final grand total only, or null if not found),
  "warrantyPeriod": "Warranty duration (e.g. '1 Year', '24 Months'), or null if not found",
  "assetName": "Exact model/name of the main purchased product, or null if not found",
  "serialNumber": "Exact serial number/id of the product, or null if not found"
}`;

    const response = await provider.generateResponse(systemPrompt, `Raw OCR Text:\n${text}`);
    
    // Parse response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in AI response.');
    }
    const data = JSON.parse(jsonMatch[0]);
    
    return {
      vendorName: data.vendorName || null,
      invoiceNumber: data.invoiceNumber || null,
      invoiceDate: data.invoiceDate || null,
      purchaseDate: data.purchaseDate || null,
      totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : null,
      warrantyPeriod: data.warrantyPeriod || null,
      assetName: data.assetName || null,
      serialNumber: data.serialNumber || null,
    };
  } catch (err) {
    logger.warn(`AI OCR parsing failed: ${err.message}. Falling back to regex parser.`);
    return null;
  }
}

function cleanOcrText(text) {
  if (!text) return '';
  return text
    .replace(/t0tal/gi, 'total')
    .replace(/am0unt/gi, 'amount')
    .replace(/grand\s*t0tal/gi, 'grand total')
    .replace(/1nvoice/gi, 'invoice')
    .replace(/inv0ice/gi, 'invoice')
    .replace(/ser1al/gi, 'serial')
    .replace(/warranty\s*per1od/gi, 'warranty period');
}

function parseInvoiceData(text) {
  const cleaned = cleanOcrText(text);
  const vendorName = extractVendorName(cleaned);
  const invoiceNumber = extractInvoiceNumber(cleaned);
  const invoiceDate = extractDate(cleaned, 'invoice');
  const purchaseDate = extractDate(cleaned, 'purchase');
  const totalAmount = extractAmount(cleaned);
  const warrantyPeriod = extractWarrantyPeriod(cleaned);
  const assetName = extractAssetName(cleaned);
  const serialNumber = extractSerialNumber(cleaned);
  const extractionConfidence = calculateConfidence({
    vendorName, invoiceNumber, invoiceDate, totalAmount,
  });

  return {
    rawText: text,
    vendorName,
    invoiceNumber,
    invoiceDate,
    purchaseDate,
    totalAmount,
    warrantyPeriod,
    assetName,
    serialNumber,
    extractionConfidence,
  };
}

// ─── Extractors ───────────────────────────────────────────────────────────────

function extractVendorName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const ignorePatterns = /^(tax\s+)?invoice$|^bill\s+to$|^ship\s+to$|^receipt$|^invoice\s+date$|^invoice\s+number$|^page\s+\d+/i;
  
  for (const line of lines) {
    if (ignorePatterns.test(line)) continue;
    if (/(?:pvt|private|ltd|limited|inc|corp|corporation|co\.|company|solutions|technologies|systems|services|mobility|enterprises|traders|distributors|retail|stores|wholesale|agency|mart|supermarket|ventures|industries|commerce)/i.test(line)) {
      return line.replace(/^(from|sold\s*by|vendor|supplier|company)[:\s]*/i, '').trim();
    }
  }
  
  const m = text.match(/(?:vendor|supplier|sold\s*by|supplier\s*name|from)[:\s]+([A-Za-z0-9\s&.,\-]+)/i);
  if (m) {
    const candidate = m[1].trim().split('\n')[0].trim();
    if (candidate.length > 2 && !ignorePatterns.test(candidate)) return candidate;
  }
  
  for (const line of lines.slice(0, 5)) {
    if (ignorePatterns.test(line)) continue;
    if (/^[A-Za-z][A-Za-z\s&.,\-]+$/.test(line) && line.length > 3) {
      return line;
    }
  }
  return null;
}

function extractInvoiceNumber(text) {
  const patterns = [
    /(?:invoice\s*no|invoice\s*number|invoice\s*id|invoice\s*#|inv\s*no|inv\s*id|inv\s*#|bill\s*no|bill\s*number|receipt\s*no|receipt\s*#)[:.#\s]+([A-Za-z0-9\-\/]+)/i,
    /(?:invoice|inv|bill|receipt)\s*[:#\s]+([A-Za-z0-9\-\/]+)/i,
    /([A-Z0-9\-\/]+)\s+(?:date|dated)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[1].trim().length > 2) {
      const val = m[1].trim();
      if (!/^(date|total|tax|invoice|bill|amount)$/i.test(val)) {
        return val;
      }
    }
  }
  return null;
}

function extractDate(text, type = 'invoice') {
  const invoicePatterns = [
    /(?:invoice\s*date|inv\s*date|date\s*of\s*issue|billing\s*date|dated)[:\s]+([^\n]+)/i,
    /(?:date|dated)[:\s]+([^\n]+)/i
  ];
  const purchasePatterns = [
    /(?:purchase\s*date|order\s*date|po\s*date|transaction\s*date)[:\s]+([^\n]+)/i
  ];
  
  const patterns = type === 'invoice' ? invoicePatterns : purchasePatterns;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const parsed = parseDateString(m[1].trim());
      if (parsed) return parsed;
    }
  }
  
  const genericPatterns = [
    /\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/,
    /\b(\d{2})[-/.](\d{2})[-/.](\d{4})\b/,
    /\b(\d{1,2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/](\d{2,4})\b/i,
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i
  ];
  
  for (const gp of genericPatterns) {
    const m = text.match(gp);
    if (m) {
      const parsed = parseDateString(m[0]);
      if (parsed) return parsed;
    }
  }
  
  return null;
}

function parseDateString(raw) {
  let clean = raw.split(/[,\n]/)[0].trim().replace(/[.:;]$/, '');
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  
  const mmmMatch = clean.match(/^(\d{1,2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/](\d{2,4})$/i);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monthStr = mmmMatch[2];
    let year = parseInt(mmmMatch[3], 10);
    if (year < 100) year += 2000;
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const month = months[monthStr.toLowerCase()];
    const d = new Date(year, month, day);
    if (!isNaN(d)) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const slashMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    
    if (part1 > 12) {
      return `${year}-${String(part2).padStart(2, '0')}-${String(part1).padStart(2, '0')}`;
    }
    const d = new Date(year, part1 - 1, part2);
    if (!isNaN(d)) {
      return `${year}-${String(part1).padStart(2, '0')}-${String(part2).padStart(2, '0')}`;
    }
  }
  
  const d = new Date(clean);
  if (!isNaN(d)) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

function extractAmount(text) {
  const lines = text.split('\n');
  const totalKeywords = /(?:grand\s*total|total\s*due|total\s*amount|total|net\s*amount|total\s*payable|balance)/i;
  
  let candidates = [];
  
  for (const line of lines) {
    if (totalKeywords.test(line)) {
      const matches = line.match(/(?:[\$₹€£]|\brs\.?|inr)?\s*([\d,]+\.\d{2})\b/i) || line.match(/([\d,]+\.\d{2})\b/);
      if (matches && matches[1]) {
        const val = parseFloat(matches[1].replace(/,/g, ''));
        if (!isNaN(val)) candidates.push(val);
      }
    }
  }
  
  if (candidates.length > 0) {
    return Math.max(...candidates);
  }
  
  const m = text.match(/(?:grand\s*total|total\s*due|total\s*amount|total)[:\s]*[\$₹€£]?\s*([\d,]+\.?\d*)/i);
  if (m) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(num)) return num;
  }
  
  return null;
}

function extractWarrantyPeriod(text) {
  const patterns = [
    /(?:warranty|warranty\s*period)[:\s]+(\d+\s*(?:year|month|day|yr|mo)s?)/i,
    /(\d+\s*(?:year|month|yr|mo)s?\s*warranty)/i,
    /warranty\s+(?:duration|term|length)[:\s]+(\d+\s*(?:year|month|day|yr|mo)s?)/i,
    /warranty\s*[:\s]*(\d+\s*(?:year|month|day|yr|mo)s?)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractAssetName(text) {
  const patterns = [
    /(?:product|item|description|asset|equipment|model\s*name)[:\s]+([A-Za-z0-9][\w\s&.,+\-()]{3,80})/i,
    /(?:desc|description)[:\s]+([A-Za-z0-9][\w\s&.,+\-()]{3,80})/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = m[1].trim().split('\n')[0].trim();
      if (val.length > 3) return val;
    }
  }
  
  const keywords = [
    /siemens\s+westrace\s+ii/i, /s700k\s+point\s+machine/i, /gedo\s+ce/i,
    /ups\s+\d+kva/i, /cctv\s+camera/i, /generator/i, /command\s+server/i,
    /network\s+switch/i, /ticket\s+counter\s+pc/i, /axle\s+counter/i,
    /track\s+circuit/i, /display\s+board/i, /fealthlite/i, /godrej/i,
    /catalyst\s+\d+/i, /optiplex\s+\d+/i, /proliant\s+\d+/i, /elitebook/i, /thinksystem/i
  ];
  for (const kw of keywords) {
    const m = text.match(kw);
    if (m) return m[0];
  }
  
  return null;
}

function extractSerialNumber(text) {
  const patterns = [
    /(?:serial\s*no|serial\s*number|serial\s*#|s\/n|s\.n\.|service\s*tag)[:.\s]*([A-Za-z0-9\-]{4,})/i,
    /\b(?:sn|ser)[:\s]*([A-Za-z0-9\-]{4,})\b/i,
    /serial\s*number\s*[:\s]*([A-Za-z0-9\-]{4,})/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const val = m[1].trim();
      if (val.length >= 4 && !/^(total|date|invoice|code|price)$/i.test(val)) {
        return val;
      }
    }
  }
  return null;
}

function calculateConfidence({ vendorName, invoiceNumber, invoiceDate, totalAmount }) {
  let fieldsFound = 0;
  if (invoiceNumber) fieldsFound++;
  if (vendorName) fieldsFound++;
  if (invoiceDate) fieldsFound++;
  if (totalAmount) fieldsFound++;
  return Math.round((fieldsFound / 4) * 100);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mimeToExt(mimetype) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return map[mimetype] || '.tmp';
}

module.exports = { extractInvoiceData };
