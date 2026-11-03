# Martian Map: Master Roadmap and Working Rules

NASA Space Apps 2026, Challenge 11 (Interplanetary Survival Guide: Martian Map).
Team: Imran (Lead), Afrazur (Technical), Masum (Data Engine), Maksumul (Science).

এই ফাইলটাই পুরো প্রজেক্টের একমাত্র roadmap। কিছু বদলাতে হলে আগে এখানে বদলাও, তারপর গ্রুপে জানাও।
কাঠামোর জন্য `PROJECT_STRUCTURE.md`, এজেন্টের নিয়মের জন্য `AGENTS.md` দেখো।

---

## 1. তারিখ (আগে এটা মিলিয়ে নাও)

| তারিখ | কী | সূত্র |
|---|---|---|
| ২৮ অক্টোবর | পূর্ণ challenge statement প্রকাশ | official timeline |
| ২ নভেম্বর | Space Apps Connect খোলে | official timeline |
| **১২ নভেম্বর** | **offline dry run সফল হতে হবে (আমাদের নিজস্ব ডেডলাইন)** | build guide |
| **১৩–১৪ নভেম্বর** | হ্যাকাথন, Bangladesh edition (build guide অনুযায়ী) | build guide |
| ১৪–১৫ নভেম্বর | হ্যাকাথন, global তারিখ | spaceappschallenge.org |
| ১৬ নভেম্বর | judging শুরু | NASA SMD |

**সতর্কতা:** build guide বলছে ১৩–১৪, কিন্তু official global সাইটে ১৪–১৫। BASIS আগের বছরগুলোতে শুক্র-শনি চালিয়েছে, তাই ১৩–১৪ সম্ভব, কিন্তু Bangladesh registration email বা BASIS পেজ থেকে **নিশ্চিত হও**। নিশ্চিত না হওয়া পর্যন্ত আমরা ১৩ তারিখ ধরে প্রস্তুত থাকব (খারাপ হলে এক দিন বাড়তি সময় পাব)।

---

## 2. পুরো প্রজেক্টের পর্যায় (phases)

```
P0 Foundation   P1 Core engine     P2 Features        P3 Freeze        P4 Hackathon
20-26 Oct       27 Oct - 2 Nov     3 - 9 Nov          10 - 12 Nov      13 - 14 Nov
repo, contract  engine + API       hazards, card,     dry runs,        polish, videos,
DEM, map, refs  + chart            offline, validate  rehearsal        submit
```

### P0: Foundation (২০–২৬ অক্টোবর)
রিপো, contract, ম্যাপে লাইন আঁকা, Jezero DEM ও ঢালের ফাংশন, reference sheet-এর প্রথম খসড়া।
**Exit:** `make test` সবুজ, ম্যাপে লাইন আঁকলে coordinates বের হয়, রোভারের constants সূত্রসহ আছে।

### P1: Core engine (২৭ অক্টোবর – ২ নভেম্বর)
- ২৮ অক্টোবরের statement পড়ে আমাদের স্কোপের সাথে মেলানো (**২৯–৩০ অক্টোবরের মধ্যে**)। নতুন dataset এলে শুধু cache করার কাজ।
- Engine: time, energy (দুই profile), hazards-এর প্রথম সংস্করণ।
- API `POST /route` চালু, contract অনুযায়ী।
- Frontend: API থেকে ফল এনে elevation chart দেখানো।
**Exit (M1, রবি ১ নভেম্বর):** walking skeleton। ম্যাপে লাইন আঁকলে API হয়ে ফল ফেরে ও chart আসে (অন্তত Rover profile-এ)।

### P2: Features (৩–৯ নভেম্বর)
- Human profile সম্পূর্ণ (দুই ledger আলাদা), hazard rules সম্পূর্ণ, safe stopping points।
- Survival card (pass/fail, energy, safe stops, ব্যর্থতার কারণ), on-screen citation।
- Offline mode: PMTiles, COG, service worker, `demo_fixtures/`।
- Validation: Perseverance-এর আসল traverse-এর সাথে মেলানো।
- Demo routes ঠিক করা: একটা fail, একটা pass।
**Exit (M2, বৃহস্পতি ৫ নভেম্বর):** দুই profile + hazards কাজ করছে, MVP-র কোনো profile মান আর `null` নয়।
**Exit (M3, রবি ৮ নভেম্বর):** **MVP freeze।** নতুন ফিচার বন্ধ, শুধু bug fix।

### P3: Freeze ও rehearsal (১০–১২ নভেম্বর)
- ১০ নভেম্বর: কোড freeze। শুধু bug fix।
- ১১ নভেম্বর (M4): ওয়াইফাই বন্ধ করে পুরো dry run, ইমরান পরিচালনা করবে। ভাঙা জিনিস তালিকা করে ঠিক করা।
- ১২ নভেম্বর (M5): **দ্বিতীয় dry run পরিষ্কারভাবে পাস।** ফলব্যাক ডেমো ভিডিও রেকর্ড। README ও project page প্রায় শেষ।

### P4: Hackathon (১৩–১৪ নভেম্বর)
build guide অনুযায়ী (তারিখ নিশ্চিত করে নিও):
- **১৩ নভেম্বর, সকাল:** registration ৭:০০, opening ১০:৩০, প্রথম mentor round ১১:৩০। সকালেই রিপো public আছে কিনা (প্রাইভেট উইন্ডোতে খুলে), project page ও challenge-এর নাম ঠিক আছে কিনা পরীক্ষা (Maksumul)।
- **১৩ নভেম্বর, বিকেল:** ২৪০ সেকেন্ডের local judging ভিডিও রেকর্ড ও **১৮:৩০-এর আগে আপলোড**।
- **১৪ নভেম্বর, সকাল:** শুধু স্থিতিশীলতা। ফিচার freeze দুপুরের আগে।
- **১৪ নভেম্বর, দুপুর ১২:০০:** ৩০ সেকেন্ডের global ভিডিও (ইংরেজি সাবটাইটেলসহ) ও চূড়ান্ত submission।

---

## 3. কে কোন পর্যায়ে কী করবে

| | P1 (২৭ অক্টো – ২ নভে) | P2 (৩–৯ নভে) | P3 (১০–১২ নভে) | P4 (১৩–১৪ নভে) |
|---|---|---|---|---|
| **Imran (Lead)** | statement vs plan মেলানো, contract চূড়ান্ত, PR review, `web/` ফ্রেম | integration test, usability test (২–৩ জন), পিচ স্ক্রিপ্ট ও স্লাইড | dry run পরিচালনা, পিচ রিহার্সাল | ভিডিও রেকর্ড, চূড়ান্ত submission দেখা |
| **Afrazur (Technical)** | API ↔ ম্যাপ জোড়া, elevation chart, Human/Rover toggle, `OFFLINE=1` | survival card, hazard overlay, citation, PMTiles + service worker, `demo_fixtures/` | offline bug fix | demo routes চালু রাখা, ছোট UI ঠিক |
| **Masum (Data Engine)** | `energy.py`, `hazards.py`, API-র জন্য compute ফল | Human ledger, roughness score, exposure limit, safe stops, validation চালানো | compute bug fix | ডেমোর সংখ্যা ঠিক আছে কিনা পাহারা |
| **Maksumul (Science)** | constants চূড়ান্ত (**মধ্য-সপ্তাহে Masum-কে হস্তান্তর**), validation traverse-এর ডেটা | README, project page, assumptions ও limitations, citation মেলানো | project page শেষ, ফলব্যাক ভিডিও | রিপো/page-এর "তিন পয়েন্ট" পরীক্ষা, ভিডিওর স্ক্রিপ্ট ও ভয়েস |

> **মনে রাখো:** সপ্তাহ ১-এ কী শেষ হয়েছে তার ওপর P1 বদলাতে পারে। সোমবারের sync-এ সত্যিকারের অবস্থা দেখে এই টেবিল হালনাগাদ করো।

---

## 4. মাইলস্টোন গেট (milestones)

| গেট | তারিখ | পাস করার শর্ত | না হলে |
|---|---|---|---|
| **M1** | রবি ১ নভেম্বর | লাইন আঁকলে API-র ফল ও chart আসে (Rover) | নতুন ফিচার বন্ধ, M1 শেষ না হওয়া পর্যন্ত শুধু এটা |
| **M2** | বৃহ ৫ নভেম্বর | দুই profile, hazards, MVP-র সব মান সূত্রসহ | যে মান সূত্র পায়নি তা "অনুমান" লিখে এগোও, নাহলে ফিচার কেটে দাও |
| **M3** | রবি ৮ নভেম্বর | MVP freeze: card, citation, offline, validation | stretch সব বাদ |
| **M4** | বুধ ১১ নভেম্বর | ওয়াইফাই বন্ধ করে dry run #1 | যা ভেঙেছে সেটাই এক নম্বর কাজ |
| **M5** | বৃহ ১২ নভেম্বর | dry run #2 পরিষ্কার, ফলব্যাক ভিডিও আছে | রাতভর ঠিক করো, কিন্তু ফিচার যোগ নয় |

---

## 5. স্কোপ কাটার ক্রম

MVP (অবশ্যই থাকবে): একটা region (Jezero), রুট আঁকা, ঢাল-দূরত্ব-সময়, Human/Rover দুই energy model, hazard flags, survival card, on-screen citation, সম্পূর্ণ offline।

সময় কম পড়লে এই ক্রমে **উপর থেকে নিচে কাটো**:
1. Bangla toggle
2. Science-interest layer (rover আবিষ্কার, খনিজ)
3. Contingency route (বিকল্প রুট)
4. Hazard overlay-র রঙ ও সাজসজ্জা

**কাটা যাবে না:** দুই আলাদা ledger, সূত্রসহ constants, offline চলা, validation। কিলার ডেমো: Jezero-তে রুট আঁকলে লাল segment দেখিয়ে reject, আবার আঁকলে pass।

---

## 6. টিমের কাজের নিয়ম (সবার জন্য এক)

### 6.1 কাজ ট্র্যাক করা
- GitHub Issues + একটা Project board: **Backlog → In progress → In review → Done**।
- প্রতিটা কাজ একটা issue, লেবেল: `P1`/`P2`/`P3`, আর মালিকের নাম (`imran`, `afrazur`, `masum`, `maksumul`)।
- কাজ শুরু করলে নিজের নামে `In progress`-এ নাও। এক সময়ে একজনের সর্বোচ্চ ২টা `In progress`।

### 6.2 প্রতিদিনের যোগাযোগ
- **রোজ রাত ৯টায় গ্রুপে ৩ লাইন:** Done / Next / Blocked। কাজ না হলেও লেখো "কিছু হয়নি, কারণ ...।"
- **সোমবার সকালে ১৫ মিনিটের sync:** গেটের অবস্থা, ঝুঁকি, এই সপ্তাহের কাজ। ইমরান এই ফাইল হালনাগাদ করবে।
- **আটকে গেলে ২৪ ঘণ্টার বেশি একা থাকবে না।** গ্রুপে `Blocked:` লিখে জানাও।

### 6.3 Git ও কোড
- Branch: `feature/<কাজ>`, `fix/<কাজ>`, `docs/<কাজ>`। `main`-এ সরাসরি push বন্ধ।
- Commit বার্তা: `feat:`, `fix:`, `docs:`, `test:`, `chore:` দিয়ে শুরু (যেমন `feat: add slope_profile`)।
- **একটা PR = একটা ছোট কাজ।** বড় PR ভেঙে দাও।
- অন্তত একজন review না করলে merge নয়। নিজের PR নিজে merge করবে না।
- Code ও comment ইংরেজিতে। দিনের আলোচনা বাংলায় চলবে।
- Units SI (মিটার, ডিগ্রি, সেকেন্ড), শুধু Wh, kcal, ঘণ্টা ছাড়া। UI-তে যেতে রূপান্তর।

### 6.4 Definition of Done (প্রতিটা কাজের শেষ শর্ত)
- [ ] `make test lint` সবুজ
- [ ] contract অপরিবর্তিত (বা ইমরান অনুমোদন করেছে)
- [ ] নতুন ডেটা/constant `docs/data_sources.md` বা `docs/reference_sheet.md`-এ সূত্রসহ লেখা
- [ ] AI ব্যবহার হলে `docs/AI_USE.md`-তে লেখা
- [ ] PR review হয়েছে

### 6.5 তিনটা কড়া নিয়ম
1. **সূত্র ছাড়া কোনো সংখ্যা নয়।** না পেলে `null` বা "অনুমান" লেখো, নিজে বানিয়ো না।
2. **Contract বদলাতে হলে** আগে `docs/contract.md`-তে প্রস্তাব, ইমরান ও যার কোড ভাঙবে সে সম্মত হলে তবেই বদলাও।
3. **Human আর Rover নিয়ে কোডে কোনো `if` নয়।** পার্থক্য শুধু `profiles/*.json`-এ।

### 6.6 এজেন্ট ব্যবহারের নিয়ম
- এজেন্টকে একবারে **একটাই কাজ** দাও, নিজের branch-এ, যে ফোল্ডারে ছুঁতে পারবে তা বলে।
- আগে প্ল্যান চাও, তারপর কোড।
- **এজেন্টের লেখা কোডও একই review ও টেস্টের আওতায়।** "এজেন্ট লিখেছে" মানে ঠিক নয়।
- প্রতিটা AI-সহায়ক পরিবর্তন `docs/AI_USE.md`-তে: কোন টুল, কী বলেছ, কী পেয়েছ।

---

## 7. ঝুঁকির তালিকা

| ঝুঁকি | সম্ভাবনা | প্রভাব | আগাম ব্যবস্থা | মালিক |
|---|---|---|---|---|
| Mars Trek ম্যাপের projection MapLibre-তে বসছে না | মাঝারি | বেশি | Leaflet-এ যাওয়া; P1-এর শুরুতেই সিদ্ধান্ত | Afrazur |
| Jezero-র DEM-এর রেজোলিউশন রুটের জন্য মোটা | মাঝারি | বেশি | HiRISE/CTX DEM খোঁজা; MOLA শুধু ফলব্যাক | Masum |
| Human-এর কিছু constant-এর সরাসরি সূত্র নেই | বেশি | মাঝারি | "অনুমান" লিখে কারণসহ; assumptions তালিকায় খোলাখুলি | Maksumul |
| Validation-এর ফল আসল traverse-এর সাথে মেলে না | মাঝারি | বেশি | পার্থক্য কেন তা লিখে দেখানো (Validity-তে এটাও নম্বর) | Masum, Maksumul |
| Offline mode ডেমোর দিনে ভাঙে | মাঝারি | **খুব বেশি** | `OFFLINE=1`, fixtures, ফলব্যাক ভিডিও; ১১ ও ১২ তারিখে dry run | Afrazur, Imran |
| ২৮ অক্টোবরের statement-এ আমাদের ধরা dataset বা নিয়ম বদলেছে | মাঝারি | বেশি | ২৯–৩০ অক্টোবরের মধ্যে diff করা | Imran |
| পরীক্ষা বা class test-এর চাপে কেউ সময় দিতে পারছে না | বেশি | মাঝারি | প্রত্যেকে এই সপ্তাহের মধ্যে নিজের ব্যস্ত দিন গ্রুপে জানাবে, সেই অনুযায়ী কাজ সাজানো | সবাই |
| হ্যাকাথনের তারিখ নিয়ে বিভ্রান্তি (১৩–১৪ না ১৪–১৫) | মাঝারি | বেশি | Bangladesh registration email ও BASIS পেজ দেখে নিশ্চিত হওয়া | Imran |

---

## 8. সাবমিশনের চেকলিস্ট (১২ নভেম্বরের মধ্যে প্রায় সব টিক)

- [ ] রিপো public (প্রাইভেট উইন্ডোতে খুলে পরীক্ষা), লাইসেন্স Apache-2.0
- [ ] README: কী, কেন, কীভাবে চালাতে হয়, ডেটা সূত্র, সীমাবদ্ধতা
- [ ] `docs/data_sources.md` ও `docs/reference_sheet.md` পূর্ণ
- [ ] `docs/AI_USE.md` পূর্ণ (টুল, prompt, কী নিজেরা করেছি)
- [ ] Project page-এর সব ঘর, challenge-এর নাম সঠিক
- [ ] ২৪০ সেকেন্ডের local video (১৩ নভেম্বর ১৮:৩০-এর আগে)
- [ ] ৩০ সেকেন্ডের global video (১৪ নভেম্বর ১২:০০-এর আগে), ইংরেজি সাবটাইটেলসহ
- [ ] ওয়াইফাই বন্ধ করে dry run দুইবার পাস
- [ ] ফলব্যাক ডেমো ভিডিও রেকর্ড করা
- [ ] Usability test (অন্তত ২–৩ জন) ও ভ্যালিডেশন ফল লেখা

---

## 9. এই ফাইল হালনাগাদের নিয়ম

- মালিক: Imran। সোমবারের sync-এর পর বদলায়।
- তারিখ বা গেট বদলালে ফাইলের নিচের লগে এক লাইন লিখে রাখো: **কী বদলাল, কেন, কে সম্মত।**

### পরিবর্তন লগ
| তারিখ | কী বদলাল | কেন | কে |
|---|---|---|---|
| ২৯ অক্টোবর | প্রথম সংস্করণ | master roadmap তৈরি | Imran |
