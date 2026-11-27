const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const dns = require('dns').promises;

chromium.use(stealth);

// ==================== CONFIGURATION ====================
const SEED_PLACES = [
    'Bahraich   271801',
    'Nanpara   271865',
    'Kaiserganj   271903',
    'Mahasi   271824',
    'Payagpur   271871',
    'Motipur / Mihinpurwa   271855',
    'Chittaura   271801',
    'Risia   271875',
    'Visheshwarganj   271821',
    'Huzoorpur   271872',
    'Jarwal / Jarwal Road   271904',
    'Fakharpur   271902',
    'Tejwapur   271825',
    'Balha   271865',
    'Nawabganj   271881',
    'Shivpur   271830',
    'Rupaidiha   271881',
    'Chilwaria   271870',
    'Khutehna   271806',
    'Baundi   271902',
    'Hardi   271825',
    'Matera   271851',
    'Babaganj   271881',
    'Charda   271881',
    'Sujauli   271841',
    'Bichhiya   271841',
    'Semari   271855',
    'Urra   271855',
    'Gangwal   271821',
];

const state = 'Uttar Pradesh';
const district = 'Bahraich';
const subDistrict = '';
const zipCode = '';

// District-based collection naming
const safeDistrictSlug = String(district).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
const contactsCollectionName = `${safeDistrictSlug}`;
const placesCollectionName = `${safeDistrictSlug}_places`;
const queriesCollectionName = `${safeDistrictSlug}_queries`;

const mongoHost = '127.0.0.1:27017';
const dbName = 'map_contact_data';
const MONGO_URI = `mongodb://${mongoHost}/${dbName}`;

const SEED_QUERY_TEMPLATES = [
    'Painter in {place}',
    'traders in {place}',
    'traveller agent $ agency in {place}',
    'grocerry shop in {place}',
    'Plumber in {place}',
    'Electrician in {place}',
    'Carpenter in {place}',
];

const MAX_RECORDS_NEEDED = 5000;
const MAX_QUERY_RETRIES = 2;

const JSON_FILE = `scraped_${safeDistrictSlug}.json`;
const CSV_FILE = `scraped_${safeDistrictSlug}.csv`;
const EXCEL_FILE = `scraped_${safeDistrictSlug}.xlsx`;

const EMAIL_CONFIG = {
    senderEmail: 'ghakskhxjdk@gmail.com',
    appPassword: '',
    receiverEmail: 'ramu@uprcart.com'
};

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

// ==================== MONGOOSE MODELS ====================
const placeContactSchema = new mongoose.Schema({
    Name: { type: String, sparse: true },
    Phone: { type: String, sparse: true },
    Address: String,
    State: String,
    District: String,
    SubDistrict: String,
    ZipCode: String,
    Website: String,
    Email: String,
    Category: String,
    CreatedAt: { type: Date, default: Date.now }
});

const placeQueueSchema = new mongoose.Schema({
    place: { type: String, required: true, unique: true },
    district: { type: String, required: true, index: true },
    state: { type: String, default: '' },
    order: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'retry'],
        default: 'pending',
        index: true
    },
    attemptCount: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    startedAt: Date,
    completedAt: Date,
    updatedAt: { type: Date, default: Date.now }
});

const searchQueryQueueSchema = new mongoose.Schema({
    place: { type: String, required: true, index: true },
    district: { type: String, required: true, index: true },
    query: { type: String, required: true },
    order: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'retry'],
        default: 'pending',
        index: true
    },
    attemptCount: { type: Number, default: 0 },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    startedAt: Date,
    completedAt: Date,
    updatedAt: { type: Date, default: Date.now }
});

searchQueryQueueSchema.index({ place: 1, query: 1 }, { unique: true });

const PlaceContactModel = mongoose.model('PlaceContactModel', placeContactSchema, contactsCollectionName);
const PlaceQueueModel = mongoose.model('PlaceQueueModel', placeQueueSchema, placesCollectionName);
const SearchQueryQueueModel = mongoose.model('SearchQueryQueueModel', searchQueryQueueSchema, queriesCollectionName);

// ==================== HELPERS ====================
const randomDelay = (min, max) =>
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

async function checkInternetConnection() {
    try {
        await dns.lookup('google.com');
        return true;
    } catch (e) {
        return false;
    }
}

async function waitUntilOnline() {
    let isOnline = await checkInternetConnection();
    if (!isOnline) {
        console.log("🌐 [OFFLINE / IDEAL STATE] इंटरनेट कनेक्शन नहीं है! स्क्रिप्ट प्रतीक्षा कर रही है...");
    }
    while (!isOnline) {
        await new Promise(res => setTimeout(res, 5000));
        isOnline = await checkInternetConnection();
        if (isOnline) {
            console.log("🟢 [ONLINE] इंटरनेट कनेक्शन फिर से चालू हो गया है! काम शुरू किया जा रहा है...");
        }
    }
}

// Helper to save a single place dynamically into DB
async function addPlaceToDB(placeName, order = null, targetDistrict = district, targetState = state) {
    const cleanPlace = String(placeName || '').trim();
    if (!cleanPlace) return null;

    const existingCount = await PlaceQueueModel.countDocuments({ district: targetDistrict });
    const resolvedOrder = typeof order === 'number' ? order : existingCount;

    const doc = await PlaceQueueModel.findOneAndUpdate(
        { place: cleanPlace },
        {
            $setOnInsert: {
                place: cleanPlace,
                district: targetDistrict,
                state: targetState,
                order: resolvedOrder,
                status: 'pending',
                attemptCount: 0,
                lastError: ''
            },
            $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
    );
    return doc;
}

// Helper to save a single search query for a place dynamically into DB
async function addQueryToDB(placeName, queryText, order = null, targetDistrict = district) {
    const cleanPlace = String(placeName || '').trim();
    const cleanQuery = String(queryText || '').trim();
    if (!cleanPlace || !cleanQuery) return null;

    const existingCount = await SearchQueryQueueModel.countDocuments({ place: cleanPlace, district: targetDistrict });
    const resolvedOrder = typeof order === 'number' ? order : existingCount;

    const doc = await SearchQueryQueueModel.findOneAndUpdate(
        { place: cleanPlace, query: cleanQuery },
        {
            $setOnInsert: {
                place: cleanPlace,
                district: targetDistrict,
                query: cleanQuery,
                order: resolvedOrder,
                status: 'pending',
                attemptCount: 0,
                retryCount: 0,
                lastError: ''
            },
            $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
    );
    return doc;
}

// Seed initial places and queries into DB without overwriting existing order/status
async function syncSeedPlacesAndQueriesToDB() {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected; cannot sync dynamic places and queries.');
    }

    if (SEED_PLACES.length > 0) {
        const placeOps = SEED_PLACES.map((placeStr, idx) => ({
            updateOne: {
                filter: { place: placeStr },
                update: {
                    $setOnInsert: {
                        place: placeStr,
                        district,
                        state,
                        order: idx,
                        status: 'pending',
                        attemptCount: 0,
                        lastError: ''
                    },
                    $set: { updatedAt: new Date() }
                },
                upsert: true
            }
        }));
        await PlaceQueueModel.bulkWrite(placeOps);
    }

    const allPlacesDocs = await PlaceQueueModel.find({ district }).sort({ order: 1, _id: 1 }).lean();

    if (SEED_QUERY_TEMPLATES.length > 0 && allPlacesDocs.length > 0) {
        const queryOps = [];
        for (const pDoc of allPlacesDocs) {
            SEED_QUERY_TEMPLATES.forEach((tpl, qIdx) => {
                const resolvedQuery = tpl.replace(/\{place\}/g, pDoc.place);
                queryOps.push({
                    updateOne: {
                        filter: { place: pDoc.place, query: resolvedQuery },
                        update: {
                            $setOnInsert: {
                                place: pDoc.place,
                                district,
                                query: resolvedQuery,
                                order: qIdx,
                                status: 'pending',
                                attemptCount: 0,
                                retryCount: 0,
                                lastError: ''
                            },
                            $set: { updatedAt: new Date() }
                        },
                        upsert: true
                    }
                });
            });
        }
        if (queryOps.length > 0) {
            await SearchQueryQueueModel.bulkWrite(queryOps);
        }
    }
}

async function setPlaceStatus(placeStr, status, errorMsg = '', incrementAttempt = false) {
    const setFields = {
        status,
        lastError: errorMsg,
        updatedAt: new Date()
    };
    if (status === 'processing') {
        setFields.startedAt = new Date();
    } else if (status === 'done') {
        setFields.completedAt = new Date();
    }

    const updateDoc = { $set: setFields };
    if (incrementAttempt) {
        updateDoc.$inc = { attemptCount: 1 };
    }

    await PlaceQueueModel.updateOne({ place: placeStr }, updateDoc);
}

async function setQueryStatus(queryDocId, status, errorMsg = '', { incrementAttempt = false, incrementRetry = false } = {}) {
    const setFields = {
        status,
        lastError: errorMsg,
        updatedAt: new Date()
    };
    if (status === 'processing') {
        setFields.startedAt = new Date();
    } else if (status === 'done') {
        setFields.completedAt = new Date();
    }

    const incFields = {};
    if (incrementAttempt) incFields.attemptCount = 1;
    if (incrementRetry) incFields.retryCount = 1;

    const updateDoc = { $set: setFields };
    if (Object.keys(incFields).length > 0) {
        updateDoc.$inc = incFields;
    }

    await SearchQueryQueueModel.updateOne({ _id: queryDocId }, updateDoc);
}

// Prioritize 'processing' (crash recovery), then 'pending', then 'retry'
async function getNextPlaceToProcess() {
    let placeDoc = await PlaceQueueModel.findOne({ district, status: 'processing' }).sort({ order: 1, _id: 1 });
    if (placeDoc) return placeDoc;

    placeDoc = await PlaceQueueModel.findOne({ district, status: 'pending' }).sort({ order: 1, _id: 1 });
    if (placeDoc) return placeDoc;

    placeDoc = await PlaceQueueModel.findOne({ district, status: 'retry' }).sort({ order: 1, _id: 1 });
    return placeDoc;
}

// Prioritize 'processing' (crash recovery), then 'pending'
async function getNextPrimaryQueryForPlace(placeStr) {
    let qDoc = await SearchQueryQueueModel.findOne({
        place: placeStr,
        district,
        status: 'processing'
    }).sort({ order: 1, _id: 1 });
    if (qDoc) return qDoc;

    qDoc = await SearchQueryQueueModel.findOne({
        place: placeStr,
        district,
        status: 'pending'
    }).sort({ order: 1, _id: 1 });
    return qDoc;
}

async function getNextRetryQueryForPlace(placeStr) {
    return await SearchQueryQueueModel.findOne({
        place: placeStr,
        district,
        status: 'retry',
        retryCount: { $lt: MAX_QUERY_RETRIES }
    }).sort({ order: 1, _id: 1 });
}

async function sendEmailAlert(subject, message, attachFile = false) {
    if (EMAIL_CONFIG.senderEmail.includes('YOUR_GMAIL') || !EMAIL_CONFIG.appPassword || !EMAIL_CONFIG.senderEmail) {
        console.log("⚠️ ईमेल अलर्ट स्किप किया गया क्योंकि ईमेल कॉन्फ़िगरेशन सेट नहीं है।");
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_CONFIG.senderEmail.trim(),
            pass: EMAIL_CONFIG.appPassword.replace(/\s/g, '')
        }
    });

    const mailOptions = {
        from: EMAIL_CONFIG.senderEmail,
        to: EMAIL_CONFIG.receiverEmail,
        subject,
        text: message
    };

    if (attachFile && fs.existsSync(EXCEL_FILE)) {
        mailOptions.attachments = [{ filename: EXCEL_FILE, path: EXCEL_FILE }];
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📩 ईमेल अलर्ट सफलतापूर्वक भेजा गया: ${subject}`);
    } catch (error) {
        console.error("\n❌ [Email Error]: ईमेल भेजने में समस्या आई!");
        console.error(`👉 एरर डिटेल: ${error.message}\n`);
    }
}

async function updateFilesAndDBLive(record, allRecords) {
    try {
        const escapedName = (record.Name || '').replace(/"/g, '""');
        const escapedAddress = (record.Address || '').replace(/"/g, '""');
        const escapedState = (record.State || '').replace(/"/g, '""');
        const escapedDistrict = (record.District || '').replace(/"/g, '""');
        const escapedSubDistrict = (record.SubDistrict || '').replace(/"/g, '""');
        const escapedCategory = (record.Category || '').replace(/"/g, '""');

        const csvLine = `"${escapedName}","${record.Phone}","${escapedAddress}","${escapedState}","${escapedDistrict}","${escapedSubDistrict}","${record.ZipCode}","${record.Website}","${record.Email}","${escapedCategory}"\n`;
        fs.appendFileSync(CSV_FILE, csvLine);

        fs.writeFileSync(JSON_FILE, JSON.stringify(allRecords, null, 4));

        const worksheet = XLSX.utils.json_to_sheet(allRecords);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Google Maps Data');
        XLSX.writeFile(workbook, EXCEL_FILE);

        if (mongoose.connection.readyState === 1) {
            try {
                await PlaceContactModel.create(record);
                console.log(`🗄️ [MongoDB Saved] DB: "${dbName}" | Collection: "${contactsCollectionName}" | Record: "${record.Name}"`);
            } catch (dbWriteErr) {
                if (dbWriteErr && dbWriteErr.code === 11000) {
                    console.log(`⏩ [SKIP - MONGO E11000 DUPLICATE] "${record.Name}" | Phone: ${record.Phone}`);
                } else {
                    console.error("⚠️ MongoDB insert error:", dbWriteErr.message);
                }
            }
        } else {
            console.log(`⚠️ [MongoDB Skip] Connection active नहीं है।`);
        }
    } catch (err) {
        console.error("⚠️ Data saving error:", err.message);
    }
}

// ==================== MAIN RUNNER ====================
(async () => {
    await waitUntilOnline();

    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log(`✅ MongoDB Database ("${dbName}") से कनेक्शन स्थापित! Collections: [${contactsCollectionName}, ${placesCollectionName}, ${queriesCollectionName}]`);
    } catch (dbErr) {
        console.error("❌ MongoDB Connection Error:", dbErr.message);
        console.error("❌ Dynamic Places/Queries के लिए MongoDB कनेक्शन आवश्यक है। स्क्रिप्ट बंद की जा रही है।");
        return;
    }

    await syncSeedPlacesAndQueriesToDB();

    let collectedData = [];
    const existingNames = new Set();
    const existingPhones = new Set();

    if (!fs.existsSync(CSV_FILE)) {
        fs.writeFileSync(CSV_FILE, 'Name,Phone,Address,State,District,SubDistrict,ZipCode,Website,Email,SearchCategory\n');
    }
    if (fs.existsSync(JSON_FILE)) {
        try {
            collectedData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
            collectedData.forEach(item => {
                if (item.Phone) existingPhones.add(item.Phone);
                if (item.Name) existingNames.add(item.Name);
            });
            console.log(`📂 पुराना डेटा लोड हुआ: ${collectedData.length} रिकॉर्ड्स पहले से मौजूद हैं।`);
        } catch (e) {
            collectedData = [];
        }
    } else {
        fs.writeFileSync(JSON_FILE, JSON.stringify([], null, 4));
    }

    let browser;
    try {
        browser = await chromium.launch({
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized'
            ]
        });
    } catch (launchErr) {
        console.error("❌ Browser Launch Failure:", launchErr.message);
        await mongoose.connection.close().catch(() => {});
        return;
    }

    let isBlockedByGoogle = false;
    let isTargetAchieved = false;
    let stopReason = "";
    let activePlaceStr = null;
    let activeQueryDoc = null;
    let isShuttingDown = false;

    async function cleanupAndExit(signalOrReason = 'SHUTDOWN') {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log(`\n🛑 [CLEANUP - ${signalOrReason}] सुरक्षित रूप से बंद किया जा रहा है...`);
        try {
            if (activeQueryDoc && mongoose.connection.readyState === 1) {
                await setQueryStatus(activeQueryDoc._id, 'processing', `Interrupted by ${signalOrReason}`, false);
            }
            if (activePlaceStr && mongoose.connection.readyState === 1) {
                await setPlaceStatus(activePlaceStr, 'processing', `Interrupted by ${signalOrReason}`, false);
            }
        } catch (e) {}

        if (browser) {
            await browser.close().catch(() => {});
        }
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close().catch(() => {});
            console.log("🔌 MongoDB Connection सुरक्षित रूप से बंद कर दिया गया।");
        }
    }

    process.on('SIGINT', async () => {
        await cleanupAndExit('SIGINT');
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await cleanupAndExit('SIGTERM');
        process.exit(0);
    });

    process.on('unhandledRejection', async (reason) => {
        console.error('❌ Unhandled Rejection:', reason);
        await cleanupAndExit('UNHANDLED_REJECTION');
        process.exit(1);
    });

    process.on('uncaughtException', async (err) => {
        console.error('❌ Uncaught Exception:', err);
        await cleanupAndExit('UNCAUGHT_EXCEPTION');
        process.exit(1);
    });

    async function executeQueryWithStatus(queryDoc) {
        if (isBlockedByGoogle || isTargetAchieved || isShuttingDown) return 'blocked';

        activeQueryDoc = queryDoc;
        await setQueryStatus(queryDoc._id, 'processing', '', { incrementAttempt: true });
        console.log(`🔄 [QUERY -> processing] "${queryDoc.query}" (Attempt: ${queryDoc.attemptCount + 1}, Retry: ${queryDoc.retryCount})`);

        await waitUntilOnline();

        const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        let context, page;

        try {
            context = await browser.newContext({
                viewport: null,
                userAgent: randomUA,
                locale: 'en-US'
            });
            page = await context.newPage();
            page.setDefaultTimeout(60000);
        } catch (ctxErr) {
            const errMsg = `Context creation failed: ${ctxErr.message}`;
            console.error(`⚠️ ${errMsg}`);
            await setQueryStatus(queryDoc._id, 'retry', errMsg, { incrementRetry: true });
            activeQueryDoc = null;
            return 'retry';
        }

        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(queryDoc.query)}`;

        try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
            await randomDelay(4000, 7000);

            const pageContent = await page.content();
            if (pageContent.includes("detected unusual traffic") || pageContent.includes("captcha")) {
                isBlockedByGoogle = true;
                stopReason = `🚨 Google Block/CAPTCHA Detected on query: "${queryDoc.query}"`;
                await setQueryStatus(queryDoc._id, 'processing', stopReason);
                await context.close().catch(() => {});
                activeQueryDoc = null;
                return 'blocked';
            }
        } catch (e) {
            const errMsg = `Navigation error: ${e.message}`;
            console.log(`⚠️ ${errMsg} for query "${queryDoc.query}"`);
            await context.close().catch(() => {});
            await setQueryStatus(queryDoc._id, 'retry', errMsg, { incrementRetry: true });
            activeQueryDoc = null;
            return 'retry';
        }

        const scrollablePanelSelector = 'div[role="feed"]';
        let isFeedFound = true;
        await page.waitForSelector(scrollablePanelSelector, { timeout: 15000 }).catch(() => {
            isFeedFound = false;
        });

        if (!isFeedFound) {
            const errMsg = `Feed panel did not load in time`;
            console.log(`⚠️ Feed panel load नहीं हुआ: "${queryDoc.query}"`);
            await context.close().catch(() => {});
            await setQueryStatus(queryDoc._id, 'retry', errMsg, { incrementRetry: true });
            activeQueryDoc = null;
            return 'retry';
        }

        let processedIndices = 0;
        let noNewItemsCounter = 0;
        let consecutiveNoPhoneCounter = 0;
        let recordsForThisQuery = 0;

        try {
            while (noNewItemsCounter < 10 && !isShuttingDown) {
                if (collectedData.length >= MAX_RECORDS_NEEDED) {
                    isTargetAchieved = true;
                    console.log(`\n🎯 कुल टारगेट (${MAX_RECORDS_NEEDED} रिकॉर्ड्स) पूरा हो गया है!`);
                    await setQueryStatus(queryDoc._id, 'done', '');
                    await context.close().catch(() => {});
                    activeQueryDoc = null;
                    return 'target_reached';
                }

                if (consecutiveNoPhoneCounter >= 15) {
                    isBlockedByGoogle = true;
                    stopReason = `🚨 Rate Limit Warning: लगातार 15 रिजल्ट्स में कोई फोन नंबर नहीं मिला।`;
                    await setQueryStatus(queryDoc._id, 'processing', stopReason);
                    await context.close().catch(() => {});
                    activeQueryDoc = null;
                    return 'blocked';
                }

                if (page.isClosed()) {
                    throw new Error('Page closed unexpectedly during scraping');
                }

                const items = await page.$$('div[role="feed"] > div > div a.hfpxzc').catch(() => []);

                if (items.length <= processedIndices) {
                    const panel = await page.$(scrollablePanelSelector).catch(() => null);
                    if (panel) {
                        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight)).catch(() => {});
                        await randomDelay(3000, 5000);
                    }

                    const newItems = await page.$$('div[role="feed"] > div > div a.hfpxzc').catch(() => []);
                    if (newItems.length === items.length) {
                        noNewItemsCounter++;
                    } else {
                        noNewItemsCounter = 0;
                    }

                    const isEnd = await page.evaluate(() => document.body.innerText.includes("You've reached the end of the list")).catch(() => false);
                    if (isEnd) {
                        console.log("🏁 Category finished.");
                        break;
                    }
                    continue;
                }

                const currentItem = items[processedIndices];
                processedIndices++;

                try {
                    await randomDelay(1500, 3000);
                    await currentItem.scrollIntoViewIfNeeded().catch(() => {});
                    await currentItem.click({ force: true, timeout: 10000 });

                    await randomDelay(3000, 5500);
                    await page.waitForSelector('h1.DUwDvf', { timeout: 5000 }).catch(() => {});

                    const nameEl = await page.$('h1.DUwDvf').catch(() => null);
                    if (!nameEl) continue;
                    const name = await nameEl.innerText().then(t => t.trim()).catch(() => 'N/A');

                    const phone = await page.$eval('button[data-item-id^="phone:tel:"]', el => {
                        return el.getAttribute('data-item-id').replace('phone:tel:', '').trim();
                    }).catch(() => null);

                    if (!phone) {
                        console.log(`⏩ [SKIP - NO PHONE] "${name}"`);
                        consecutiveNoPhoneCounter++;
                        continue;
                    }

                    consecutiveNoPhoneCounter = 0;

                    if (existingPhones.has(phone) || (name !== 'N/A' && existingNames.has(name))) {
                        console.log(`⏩ [SKIP - MEMORY DUPLICATE] "${name}" | Phone: ${phone}`);
                        continue;
                    }

                    if (mongoose.connection.readyState === 1) {
                        const duplicateInDB = await PlaceContactModel.findOne({
                            $or: [{ Phone: phone }, { Name: name }]
                        }).catch(() => null);

                        if (duplicateInDB) {
                            console.log(`⏩ [SKIP - MONGO DUPLICATE] "${name}" | Phone: ${phone}`);
                            existingPhones.add(phone);
                            if (name !== 'N/A') existingNames.add(name);
                            continue;
                        }
                    }

                    const address = await page.$eval('button[data-item-id="address"]', el => el.innerText.trim()).catch(() => 'N/A');

                    let extractedZip = zipCode;
                    if (address !== 'N/A') {
                        const pinMatch = address.match(/\b\d{6}\b/);
                        if (pinMatch) extractedZip = pinMatch[0];
                    }

                    const weblink = await page.$eval('a[data-item-id="authority"]', el => el.getAttribute('href')).catch(() => 'N/A');

                    let email = 'N/A';
                    try {
                        const panelText = await page.evaluate(() => document.querySelector('div[role="main"]')?.innerText || '');
                        const emailMatches = panelText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
                        if (emailMatches && emailMatches.length > 0) {
                            const validEmail = emailMatches.find(e => !e.includes('google') && !e.includes('schema'));
                            if (validEmail) email = validEmail;
                        }
                    } catch (e) {}

                    const record = {
                        Name: name,
                        Phone: phone,
                        Address: address,
                        State: state,
                        District: district,
                        SubDistrict: subDistrict,
                        ZipCode: extractedZip,
                        Website: weblink,
                        Email: email,
                        Category: queryDoc.query
                    };

                    existingPhones.add(phone);
                    if (name !== 'N/A') existingNames.add(name);

                    collectedData.push(record);
                    recordsForThisQuery++;

                    await updateFilesAndDBLive(record, collectedData);
                    console.log(`✅ [SAVED (${collectedData.length} Total)] ${name} | 📞 ${phone} | 📍 ${queryDoc.place}`);

                    await randomDelay(2000, 4500);
                } catch (itemErr) {
                    console.error(`⚠️ Item skipped at index ${processedIndices} due to:`, itemErr.message);
                }
            }

            if (isShuttingDown) {
                await context.close().catch(() => {});
                activeQueryDoc = null;
                return 'blocked';
            }

            await setQueryStatus(queryDoc._id, 'done', '');
            console.log(`✅ [QUERY -> done] "${queryDoc.query}" (Added ${recordsForThisQuery} unique records).`);
            await context.close().catch(() => {});
            activeQueryDoc = null;

            if (!isBlockedByGoogle && !isTargetAchieved) {
                await randomDelay(8000, 12000);
            }
            return 'done';
        } catch (loopErr) {
            const errMsg = `Query loop error: ${loopErr.message}`;
            console.error(`❌ ${errMsg} on "${queryDoc.query}"`);
            await context.close().catch(() => {});
            await setQueryStatus(queryDoc._id, 'retry', errMsg, { incrementRetry: true });
            activeQueryDoc = null;
            return 'retry';
        }
    }

    try {
        while (!isBlockedByGoogle && !isTargetAchieved && !isShuttingDown) {
            const placeDoc = await getNextPlaceToProcess();
            if (!placeDoc) {
                console.log("\n🏁 सभी Places सफलतापूर्वक पूरे हो गए हैं!");
                break;
            }

            activePlaceStr = placeDoc.place;
            await setPlaceStatus(placeDoc.place, 'processing', '', true);
            console.log(`\n==================================================`);
            console.log(`📍 [PLACE -> processing]: "${placeDoc.place}"`);
            console.log(`==================================================`);

            // 1. Primary queries ('processing' first for crash recovery, then 'pending')
            while (!isBlockedByGoogle && !isTargetAchieved && !isShuttingDown) {
                const nextQuery = await getNextPrimaryQueryForPlace(placeDoc.place);
                if (!nextQuery) break;

                console.log(`🔎 [PRIMARY QUERY]: "${nextQuery.query}"`);
                await executeQueryWithStatus(nextQuery);
            }

            if (isBlockedByGoogle || isTargetAchieved || isShuttingDown) break;

            // 2. Retry failed ('retry') queries of this place once primary queries finish
            const retryCandidatesCount = await SearchQueryQueueModel.countDocuments({
                place: placeDoc.place,
                district,
                status: 'retry',
                retryCount: { $lt: MAX_QUERY_RETRIES }
            });

            if (retryCandidatesCount > 0) {
                console.log(`\n🔁 [END-OF-PLACE RETRY] "${placeDoc.place}" की बाकी queries पूरी हुईं। अब ${retryCandidatesCount} error/retry queries दोबारा चलाई जा रही हैं...`);
                while (!isBlockedByGoogle && !isTargetAchieved && !isShuttingDown) {
                    const retryQuery = await getNextRetryQueryForPlace(placeDoc.place);
                    if (!retryQuery) break;

                    console.log(`🔂 [RETRY QUERY #${retryQuery.retryCount + 1}]: "${retryQuery.query}"`);
                    await executeQueryWithStatus(retryQuery);
                }
            }

            if (isBlockedByGoogle || isTargetAchieved || isShuttingDown) break;

            // 3. Finalize place status
            const remainingUnfinished = await SearchQueryQueueModel.countDocuments({
                place: placeDoc.place,
                district,
                status: { $in: ['pending', 'processing', 'retry'] }
            });

            if (remainingUnfinished === 0) {
                await setPlaceStatus(placeDoc.place, 'done', '');
                console.log(`🎉 [PLACE -> done]: "${placeDoc.place}" की सभी queries पूरी हो गईं।`);
            } else {
                await setPlaceStatus(placeDoc.place, 'retry', `${remainingUnfinished} queries still in retry/pending`);
                console.log(`⚠️ [PLACE -> retry]: "${placeDoc.place}" में ${remainingUnfinished} queries retry सीमा के कारण बाकी हैं।`);
            }

            activePlaceStr = null;
        }

        if (!isBlockedByGoogle && !isShuttingDown) {
            const successMsg = `🎉 स्क्रैपिंग पूरी हो गई है!\n\nकुल रिकॉर्ड्स: ${collectedData.length}`;
            await sendEmailAlert('✅ Google Maps Scraper: Success Notification', successMsg, true);
        }
    } catch (globalError) {
        stopReason = `❌ Fatal Runtime Error: ${globalError.message}`;
        console.error(stopReason);
        if (activeQueryDoc) {
            await setQueryStatus(activeQueryDoc._id, 'retry', globalError.message, { incrementRetry: true }).catch(() => {});
        }
        if (activePlaceStr) {
            await setPlaceStatus(activePlaceStr, 'processing', globalError.message).catch(() => {});
        }
    } finally {
        if (!isShuttingDown) {
            if (browser) {
                await browser.close().catch(() => {});
            }

            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close().catch(() => {});
                console.log("🔌 MongoDB Connection सुरक्षित रूप से बंद कर दिया गया।");
            }
        }

        if (isBlockedByGoogle || stopReason.startsWith("❌")) {
            const alertMsg = `${stopReason}\n\nकुल ${collectedData.length} रिकॉर्ड्स सेव हुए।\n\n📌 Place और Query का status MongoDB (${placesCollectionName}, ${queriesCollectionName}) में सेव है। दोबारा रन करने पर वहीं से शुरू होगा।`;
            await sendEmailAlert('🚨 Google Maps Scraper: STOPPED / ERROR ALERT', alertMsg, false);
        }
    }
})();

module.exports = {
    addPlaceToDB,
    addQueryToDB,
    PlaceContactModel,
    PlaceQueueModel,
    SearchQueryQueueModel
};