# 60-second judge walkthrough

Kept up to date as the build progresses (CLAUDE.md §10). Full audit results: [docs/AUDIT.md](docs/AUDIT.md).

1. ✅ **Gate intro & 3D Helix Hero**: On first visit, a scroll-driven camera glide towards the SRM arch welcomes you into the site (with an instant Skip button). The hero features "Level Up at SRM" over an interactive 3D turning helix of quest cards around SRM's emblem.
2. ✅ **Character Card & Path Picker**: Under "Your Character", pick a path (**Building · Research · Sport · Startups**) → the character levels up, XP bars fill, and verified SRM quests appear in real time.
3. ✅ **Live Kattankulathur Clock & National Champions**: Scroll to the lilac chapter to see the live time at the campus and Team Camber Racing's Formula Bharat national championship quest card.
4. ✅ **Quest Board & Verified Proof**: Scroll the horizontal quest board (real student work, Apple Swift Student Challenge winner, the Volvo Vehicle Technology Centre) and verified proof points: NIRF 2025 #11 University, NAAC A++, 10,190+ offers (2025 batch).
5. ✅ **Explore Map & "How far is SRM from home?"**: Pick **Madurai** under "Where are you coming from?" → arcs fly out to every campus, Tiruchirappalli is marked nearest (≈ 135 km), the list re-sorts by distance, and directions start from home. Tap **Take the 360° tour** for Kattankulathur's in-page virtual tour.
6. ✅ **Programme Finder with AI**: Under "Start your run", type "robotics" or "I want to become a dentist" → instant answer cards with real fees, eligibility, and entrance details. Or search by meaning on `/programmes` for "AI picks for you".
7. ✅ **Toggle Tamil & Hindi**: Header switcher **EN · த · हि** (top right; inside "Menu" on mobile) — translates the full site, preserving your current search and parameters.
8. ✅ **Parent Mode on Programme Pages**: Open `/programmes/btech-cse`, toggle **Parent Mode** → the page leads with plain answers: cost, admission, location + directions, safety/hostel links, jobs, and large Call Admissions buttons. Below it, check **Ask a Senior** (demo threads that show the moderation states; not real students yet).
9. ✅ **Command Palette & Compare**: Press ⌘K (or tap search on phone) to jump anywhere. Check **Compare** on two programmes to see fees, eligibility and deadlines side by side with differences highlighted in a shareable link.
10. ✅ **Ask SRM Assistant (Leafy)**: Tap the Leafy mascot button (bottom-right on any page) → verified answers on fees, deadlines, and hostels with Admissions direct dial, backed by a free AI fallback.
11. ✅ **Works Offline**: Tap **Save for offline**, disconnect network and reload → offline service worker serves saved pages and helpful offline fallback.
12. ✅ **3D Hostels**: Visit `/hostels` to explore every block with photos, warden contacts, 2026–27 fee tables, mess timings, and an interactive 3D campus model.
13. ✅ **Walk SRM**: Click **🎮 Play 3D** in the header → **Begin**. You start at the pink arch gate, facing up the avenue to the clock tower. Walk (WASD, tap the ground, or the thumb stick on a phone), press **Space** to jump and **R** to run. Walk up to a student on the road and press **E** to say hi. Tap the yellow **Admissions counsellor** bubble: you walk there and they start the **First day** quest. Press **M** for the map and **Jump there** to Java Food Court; the senior finishes the quest and offers the next one. 👕 changes your outfit. Every building card opens its real page.

Before the demo: paste a programme link into WhatsApp Web and check the preview card appears (it needs `NEXT_PUBLIC_SITE_URL` set to the live https address in Vercel). Keep the walkthrough under 90 seconds, and record it as a screen capture in case the venue's Wi-Fi fails.

Bonus: turn on "Reduce motion" in OS settings → Lite Mode switches on automatically, strips 3D/video, and displays why.
