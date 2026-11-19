const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Stealth प्लगइन को इनेबल करें
chromium.use(stealth);

// ==================== CONFIGURATION ====================
const PLACES = [
"Tarun - 224205",
  "Harringtonganj - 224208",
  "Amaniganj - 224121"
];

const state = 'Uttar Pradesh'; 
const district = 'Ayodhya';       
const subDistrict = '';    
const zipCode = '';      

const mongoHost = '127.0.0.1:27017'; 
const dbName = 'map_contact_data';          
const collectionName = `${district}`; 

const MONGO_URI = `mongodb://${mongoHost}/${dbName}`;

const getSearchQueries = (currentPlace) => [
    `Painter in ${currentPlace}`,
    `traders in ${currentPlace}`,
    `traveller agent $ agency in ${currentPlace}`,
    `grocerry shop in ${currentPlace}`,
    `Plumber in ${currentPlace}`,
    `Electrician in ${currentPlace}`,
    `Carpenter in ${currentPlace}`,
    `AC Repair / Appliance Repair in ${currentPlace}`,
    `Pest Control Service in ${currentPlace}`,
    `Home Cleaning Services in ${currentPlace}`,
    `Courier Service / Logistics in ${currentPlace}`,
    `Dry Cleaners & Laundry in ${currentPlace}`,
    `Photostat / Printing Shop in ${currentPlace}`,
    `Tailor / Boutique in ${currentPlace}`,
    `Packers and Movers in ${currentPlace}`,
    `Hair Salon / Barber Shop in ${currentPlace}`,
    `Beauty Parlour in ${currentPlace}`,
    `Gym / Fitness Center in ${currentPlace}`,
    `Yoga Studio in ${currentPlace}`,
    `Spa & Massage Center in ${currentPlace}`,
    `Tattoo Shop in ${currentPlace}`,
    `Coaching Center / Tuition & Home Tutors in ${currentPlace}`,
    `Driving School in ${currentPlace}`,
    `Computer Training School in ${currentPlace}`,
    `Library / Study Rooms in ${currentPlace}`,
    `Bookstore / Stationery Shop in ${currentPlace}`,
    `Mobile Phone Repair Shop in ${currentPlace}`,
    `Mobile Shop in ${currentPlace}`,
    `Computer Repairing Shop in ${currentPlace}`,
    `Computer Shop in ${currentPlace}`,
    `Hardware Store in ${currentPlace}`,
    `Saree Shop / Clothing Store in ${currentPlace}`,
    `Cosmetic Shops in ${currentPlace}`,
    `Shopping Mall in ${currentPlace}`,
    `Jewellery Store in ${currentPlace}`,
    `Pet Shop & Veterinary Clinic in ${currentPlace}`,
    `Gift Shop / Toy Store in ${currentPlace}`,
    `Chartered Accountant (CA) in ${currentPlace}`,
    `Law Firm / Advocate in ${currentPlace}`,
    `Real Estate Agency / Property Dealer in ${currentPlace}`,
    `Photographer / Photo Studio in ${currentPlace}`,
    `Schools, Colleges & Universities in ${currentPlace}`,
    `Skill Institutes (Fashion Designing, Beauty Academy, Digital Marketing) in ${currentPlace}`,
    `Language & Hobby Classes (English Speaking, Music/Dance, Martial Arts) in ${currentPlace}`,
    `Hospitals & Trauma Centers in ${currentPlace}`,
    `Pharmacy & Medical Shop in ${currentPlace}`,
    `Diagnostic Centers & Pathology Labs in ${currentPlace}`,
    `Mental Health & Counseling Centers in ${currentPlace}`,
    `Swimming Pools in ${currentPlace}`,
    `Cinema Halls & Multiplexes in ${currentPlace}`,
    `Amusement Parks & Water Parks in ${currentPlace}`,
    `Car & Bike Showrooms in ${currentPlace}`,
    `4-Wheeler Showrooms in ${currentPlace}`,
    `Car & Bike Repair Shop in ${currentPlace}`,
    `Used Car Dealers in ${currentPlace}`,
    `Car Wash & Detailing Centers in ${currentPlace}`,
    `Tyre Shop & Wheel Alignment in ${currentPlace}`,
    `Battery & Inverter Dealers in ${currentPlace}`,
    `Banquet Halls & Marriage Lawns in ${currentPlace}`,
    `Restaurants in ${currentPlace}`,
    `Puja Samagri Shops in ${currentPlace}`,
    `Astrologer & Pandit / Jyotish in ${currentPlace}`,
    `Hotels & OYO in ${currentPlace}`,
    `Gas Stove & Cylinder Repair in ${currentPlace}`,
    `Watch & Clock Repair Shop in ${currentPlace}`,
    `Bars in ${currentPlace}`,
    `Fastag Agents in ${currentPlace}`,
    `Gold Loan Companies in ${currentPlace}`,
    `Loan Agents in ${currentPlace}`,
    `LIC & Insurance Agents in ${currentPlace}`,
    `Car Rental & Bike Rental in ${currentPlace}`,
    `Key Maker / Locksmith in ${currentPlace}`,
    `Tea & Coffee Stalls / Tapri in ${currentPlace}`,
    `Dairy & Milk Booth in ${currentPlace}`,
    `Ice Cream Parlors & Juice Centers in ${currentPlace}`,
    `Meat, Chicken & Fish Shops in ${currentPlace}`,
    `Bakery & Cake Shops in ${currentPlace}`,
    `Sweet Shops (Mithai ki Dukan) in ${currentPlace}`,
    `Caterers & Halwai in ${currentPlace}`,
    `Event Planners & Decorators in ${currentPlace}`,
    `DJ & Sound Systems in ${currentPlace}`,
    `Tent House in ${currentPlace}`,
    `Electronic Stores in ${currentPlace}`,
    `Furniture Showrooms in ${currentPlace}`,
    `Flex, Banner & Signboard Printers in ${currentPlace}`,
    `Solar Panel Dealers in ${currentPlace}`,
    `Agriculture / Pesticide Shops in ${currentPlace}`,
    `Optical Shops (Chashme ki Dukan) in ${currentPlace}`,
    `Footwear Stores in ${currentPlace}`,
    `Nursery & Plant Shops in ${currentPlace}`,
    `Scrap Dealers (Kabadiwala) in ${currentPlace}`,
    `Delivery boy in ${currentPlace}`,
    `petrolpump in ${currentPlace}`,
    `adhar center $ csc in ${currentPlace}`
];

const MAX_RECORDS_NEEDED = 8000;
const JSON_FILE = `scraped_${district}.json`;
const CSV_FILE = `scraped_${district}.csv`;
const EXCEL_FILE = `scraped_${district}.xlsx`;
const PROGRESS_FILE = `progress_${district}.json`; // 🟢 स्टेट को ट्रैक करने वाली फ़ाइल

// --- 📧 ईमेल कॉन्फ़िगरेशन ---
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

const placeSchema = new mongoose.Schema({
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

const PlaceModel = mongoose.model('CustomPlaceModel', placeSchema, collectionName);

const randomDelay = (min, max) => 
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

// 🟢 प्रोग्रेस सेव करने का हेल्पर फ़ंक्शन
function saveProgress(placeIdx, queryIdx, placeName, queryName) {
    try {
        const stateData = {
            placeIndex: placeIdx,
            queryIndex: queryIdx,
            placeName: placeName,
            queryName: queryName,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(stateData, null, 2));
    } catch (e) {
        console.error("⚠️ Failed to write progress file:", e.message);
    }
}

// 🟢 प्रोग्रेस लोड करने का हेल्पर फ़ंक्शन
function loadProgress() {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            const raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("⚠️ Error reading progress file:", e.message);
    }
    return null;
}

async function sendEmailAlert(subject, message, attachFile = false) {
    if (EMAIL_CONFIG.senderEmail.includes('YOUR_GMAIL') || !EMAIL_CONFIG.appPassword || !EMAIL_CONFIG.senderEmail) {
        console.log("⚠️ ईमेल अलर्ट स्किप किया गया क्योंकि ईमेल कॉन्फ़िगरेशन सेट नहीं है।");
        return;
    }
    
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_CONFIG.senderEmail.trim(),
            pass: EMAIL_CONFIG.appPassword.replace(/\s/g, '')
        }
    });

    let mailOptions = {
        from: EMAIL_CONFIG.senderEmail,
        to: EMAIL_CONFIG.receiverEmail,
        subject: subject,
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
            await PlaceModel.create(record);
            console.log(`🗄️ [MongoDB Saved] DB: "${dbName}" | Collection: "${collectionName}" | Record: "${record.Name}"`);
        } else {
            console.log(`⚠️ [MongoDB Skip] Connection active नहीं है।`);
        }

    } catch (err) {
        console.error("⚠️ Data saving error:", err.message);
    }
}

(async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log(`✅ MongoDB Database ("${dbName}") से सफलतापूर्वक कनेक्शन स्थापित हुआ!`);
    } catch (dbErr) {
        console.error("❌ MongoDB Connection Error:", dbErr.message);
        console.log("⚠️ चेतावनी: केवल लोकल फाइल्स (CSV/JSON/XLSX) में डेटा सेव होगा।");
    }

    // 🟢 फाइल इनिशियलाइज़ेशन (पुराना डेटा ओवरराइट नहीं होगा)
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

    // 🟢 रीस्टार्ट / रिज्यूम चेकपॉइंट तय करना
    let startPlaceIdx = 0;
    let startQueryIdx = 0;

    const lastProgress = loadProgress();
    if (lastProgress) {
        console.log(`\n==================================================`);
        console.log(`🔄 [RESUME MODE DETECTED] पिछली स्थिति पाई गई:`);
        console.log(`📌 Place: ${lastProgress.placeName} (Index: ${lastProgress.placeIndex})`);
        console.log(`📌 Last Query: "${lastProgress.queryName}" (Index: ${lastProgress.queryIndex})`);
        
        startPlaceIdx = lastProgress.placeIndex || 0;
        // 🟢 एक क्वेरी पीछे से शुरू करना
        startQueryIdx = Math.max(0, (lastProgress.queryIndex || 0) - 1);
        console.log(`⏪ सेफ्टी के लिए 1 स्टेप पीछे से Query Index [${startQueryIdx}] से शुरू किया जा रहा है।`);
        console.log(`==================================================\n`);
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
        return;
    }

    let isBlockedByGoogle = false;
    let isTargetAchieved = false;
    let stopReason = "";

    try {
        for (let pIndex = startPlaceIdx; pIndex < PLACES.length; pIndex++) {
            if (isBlockedByGoogle || isTargetAchieved) break;

            const currentPlace = PLACES[pIndex];
            const SEARCH_QUERIES = getSearchQueries(currentPlace);

            // अगर यह वही स्थान है जहाँ रुका था, तो startQueryIdx से शुरू करें; अगले स्थानों के लिए 0 से
            const currentStartQIdx = (pIndex === startPlaceIdx) ? startQueryIdx : 0;

            for (let qIndex = currentStartQIdx; qIndex < SEARCH_QUERIES.length; qIndex++) {
                if (isBlockedByGoogle || isTargetAchieved) break;

                const currentQuery = SEARCH_QUERIES[qIndex];
                const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                
                // 🟢 प्रोग्रेस स्टेट को फ़ाइल में सेव करें
                saveProgress(pIndex, qIndex, currentPlace, currentQuery);

                // 🟢 लाइव कंसोल नोटिस
                console.log(`\n==================================================`);
                console.log(`📍 [PLACE ${pIndex + 1}/${PLACES.length}]: "${currentPlace}"`);
                console.log(`🔎 [QUERY ${qIndex + 1}/${SEARCH_QUERIES.length}]: "${currentQuery}"`);
                console.log(`==================================================`);

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
                    console.error("⚠️ Context creation failed, retrying next query...", ctxErr.message);
                    continue;
                }

                const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(currentQuery)}`;
                
                try {
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
                    await randomDelay(4000, 7000);

                    const pageContent = await page.content();
                    if (pageContent.includes("detected unusual traffic") || pageContent.includes("captcha")) {
                        isBlockedByGoogle = true;
                        stopReason = `🚨 Google Block/CAPTCHA Detected on query: "${currentQuery}"`;
                        await context.close().catch(() => {});
                        break;
                    }
                } catch (e) {
                    console.log(`⚠️ Navigation error for query "${currentQuery}": ${e.message}`);
                    await context.close().catch(() => {});
                    continue;
                }

                const scrollablePanelSelector = 'div[role="feed"]';
                await page.waitForSelector(scrollablePanelSelector, { timeout: 15000 }).catch(() => {
                    console.log("⚠️ Feed panel load होने में समय लगा...");
                });

                let processedIndices = 0;
                let noNewItemsCounter = 0;
                let consecutiveNoPhoneCounter = 0; 
                let recordsForThisQuery = 0;

                while (noNewItemsCounter < 10) {
                    if (collectedData.length >= MAX_RECORDS_NEEDED) {
                        isTargetAchieved = true;
                        console.log(`\n🎯 कुल टारगेट (${MAX_RECORDS_NEEDED} रिकॉर्ड्स) पूरा हो गया है!`);
                        break;
                    }

                    if (consecutiveNoPhoneCounter >= 15) {
                        isBlockedByGoogle = true;
                        stopReason = `🚨 Rate Limit Warning: लगातार 15 रिजल्ट्स में कोई फोन नंबर नहीं मिला।`;
                        break;
                    }

                    if (page.isClosed()) {
                        console.log("⚠️ पेज बंद पाया गया, अगले आइटम पर बढ़ रहे हैं...");
                        break;
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
                            const duplicateInDB = await PlaceModel.findOne({
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
                            Category: currentQuery
                        };

                        existingPhones.add(phone);
                        if (name !== 'N/A') existingNames.add(name);

                        collectedData.push(record);
                        recordsForThisQuery++;

                        await updateFilesAndDBLive(record, collectedData);

                        console.log(`✅ [SAVED (${collectedData.length} Total)] ${name} | 📞 ${phone} | 📍 ${currentPlace}`);

                        await randomDelay(2000, 4500);

                    } catch (itemErr) {
                        console.error(`⚠️ Item skipped at index ${processedIndices} due to:`, itemErr.message);
                    }
                }

                console.log(`📊 Completed Query "${currentQuery}". Added ${recordsForThisQuery} unique records.`);
                await context.close().catch(() => {});
                
                if (!isBlockedByGoogle && !isTargetAchieved) {
                    await randomDelay(8000, 12000);
                }
            }
        }

        if (!isBlockedByGoogle) {
            // काम पूरा होने पर progress file डिलीट कर दें ताकि अगली बार फ्रेश शुरू हो सके
            if (fs.existsSync(PROGRESS_FILE)) {
                fs.unlinkSync(PROGRESS_FILE);
            }
            const successMsg = `🎉 स्क्रैपिंग पूरी हो गई है!\n\nकुल नया डेटा: ${collectedData.length} रिकॉर्ड्स`;
            await sendEmailAlert('✅ Google Maps Scraper: Success Notification', successMsg, true);
        }

    } catch (globalError) {
        stopReason = `❌ Fatal Runtime Error: ${globalError.message}`;
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("🔌 MongoDB Connection सुरक्षित रूप से बंद कर दिया गया।");
        }

        if (isBlockedByGoogle || stopReason.startsWith("❌")) {
            const alertMsg = `${stopReason}\n\nकुल ${collectedData.length} रिकॉर्ड्स सेव हुए।\n\n📌 आपकी स्थिति (Progress) सुरक्षित सेव है। दोबारा रन करने पर यह यहीं से चालू होगी।`;
            await sendEmailAlert('🚨 Google Maps Scraper: STOPPED / ERROR ALERT', alertMsg, false);
        }
    }
})();