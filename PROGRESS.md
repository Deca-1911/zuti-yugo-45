# PROGRESS — Žuti Yugo 45

- [x] **Faza 1** — Scena + Yugo + vožnja + chase kamera + touch/keyboard kontrole
  - Gradient nebo (shader kupola), sunce, fog, DirectionalLight + AmbientLight, bez shadow mapa (tamni krug ispod vozila)
  - Žuti Yugo 45: kockasta silueta, kratka hauba, ravna zadnja, crni branici, tamna stakla, kotači se okreću i skreću
  - Fizika: sporo, glatko, oprostivo (max ~11 m/s, blago klizanje, lagani rikverc na kočnicu kad stoji)
  - Chase kamera s blagim nagibom u zavoju; multi-touch gumbi (pointer eventi po gumbu) + tipkovnica
- [x] **Faza 2** — Cijela mapa
  - Gradić: 26 kućica s crvenim krovovima (instanced), drveće, semafori koji stvarno rade (ciklus zeleno/žuto/crveno), zebre
  - Most s crvenim lukovima, vješaljkama i stupovima; prava rampa uzbrdo (terrainHeight); plava rijeka + brodić koji plovi ispod
  - Autoput (22 m širine) + 13 bijelih vjetrenjača s 3 kraka, svaka se okreće drugom brzinom
  - Parking s iscrtanim mjestima, jedno pulsira zeleno; stanica hitnih službi (vatrogasci + policija + bolnica)
  - Brda u daljini, low-poly oblaci; nevidljivi zidovi na rubu; obale rijeke blokirane osim mosta
- [x] **Faza 3** — NPC vozila + AI
  - Waypoint AI (loop + pingpong), usporavanje/zaustavljanje pred Yugom, zaustavljanje na crveno
  - 🚒 vatrogasci (ljestve + rotirka, povremena intervencija sa sirenom), 🚑 hitna (plava rotirka, preko mosta),
    🚓 policija (zabljesne kad Yugo prođe ili zatrubi), 🛻 vučna vuče pokvareni auto, 🕷️ pauk diže sivi auto u petlji, 3 obična autića
  - Sudar = mekano odbijanje + "boing"; statične prepreke meko izguravaju (nema zapinjanja)
- [x] **Faza 4** — Misije + zvjezdice + konfeti
  - 5 misija s velikim ikonama: 🌉 → 🌬️ → 🅿️ (parkiraj polako na zeleno) → 🚒 → 🎺 (truba kod policije)
  - Misija = ⭐ + konfeti (Points pool, 1 draw call) + veseli zvuk + veliki splash; 5/5 = BRAVO! 🏆 ekran pa slobodna vožnja
  - 3D strelica iznad Yuga pokazuje smjer; 10 rotirajućih zvjezdica po mapi ("din-din")
- [x] **Faza 5** — Web Audio + poliranje
  - Sinteza: motor ovisan o brzini (2 osc + lowpass), truba + 3D oblačić "Bip-bip!" (canvas sprite), sirene (kratke, tihe),
    "din-din", "boing", jingle za misiju i BRAVO; otključavanje na prvi dodir (▶ VOZI!)
  - Start ekran, fullscreen + landscape lock, gumb 🔄 (vraća na najbližu cestu), hint za okretanje mobitela u portraitu
  - pixelRatio cap 2, instanced geometrija, dijeljeni materijali, nula alokacija po frameu u petlji
- [x] **QA** — kritičar-prolaz (headless Chromium + Playwright)
  1. Konzola bez grešaka — **PROŠAO** (0 pageerror; samo SwiftShader upozorenja headless okruženja)
  2. Dijete od 5 g. pokreće samo — **PROŠAO** (jedan veliki zeleni "▶ VOZI!", odmah vožnja, bez teksta u igri)
  3. Multi-touch dva prsta — **PROŠAO** (svaki gumb ima vlastite pointer evente + setPointerCapture, neovisni)
  4. Nemoguće izgubiti — **PROŠAO** (nema game overa; prepreke izguravaju; 🔄 testiran; rikverc na kočnicu)
  5. Yugo prepoznatljiv — **PROŠAO** (žuta kockasta silueta, kratka hauba, ravna zadnja, crni branici, screenshotovi provjereni)
  6. Vjetrenjače / pauk / rotirke — **PROŠAO** (13 rotora različitih brzina, pauk petlja 14 s, rotirke se vrte, policija bljeska)
  7. Budžet — **PROŠAO** (izmjereno: 11.668 trokuta, 240 draw calls; petlja bez alokacija)
  8. 100% offline — **PROŠAO** (samo lokalne datoteke: index.html, game.js, three.module.js; nula vanjskih URL-ova u runtimeu)
