# Post drafts

Upload the video (`video/out/sarkari-saathi-demo.mp4`, 78 s) directly to each post (not as a YouTube link). Tag Gnani AI's page by typing "@Gnani" and picking it from the list, and check their exact handle on X. If a family member's story is behind this project, add it as a second paragraph: a true personal line will do more than anything below.

The demo runs on Gemini Flash-Lite for the fact-extraction step, so the posts say so. The contest rules ban misleading demos.

## LinkedIn

Posted 2026-10-20: https://www.linkedin.com/feed/update/urn:li:activity:7518269164248289280/

> आप बोलिए, फ़ॉर्म अपने-आप भरेगा।
> Speak, and the form fills itself in.
>
> A woman farmer in Nashik may qualify for several government schemes. To find out which, she has to get through forms that assume she can read and type.
>
> For the Great Indian AI Internship Challenge I built Sarkari Saathi. You talk to it in Marathi, Hindi or English and it talks back, with no buttons to press between turns: it asks a short question, listens, and writes your answer into a form on screen while you speak.
>
> In the demo, one Marathi sentence fills three fields at once: ration card, daughter's age and family income. Four short answers later she sees 8 central and Maharashtra schemes she may qualify for, with the documents to carry, and can tap any card to hear it read aloud. (Sunita is an invented persona with a synthetic ElevenLabs voice; everything the app says and shows is its real output.)
>
> How it works:
> 1) Gnani Prisma turns her speech into text ("पंचेचाळीस" arrives as 45).
> 2) A small LLM (Gemini Flash-Lite) picks out the facts.
> 3) Plain code checks them against eligibility rules taken from government scheme pages.
> 4) Gnani Timbre speaks every reply back.
>
> The AI listens and the code decides, so it can't invent a scheme or promise money that isn't there. When a rule depends on something it didn't ask, the card says "likely" and tells her what to confirm.
>
> Try it: https://sarkari-saathi-kjgb.onrender.com (the free server can take a minute to wake up)
> Code: https://github.com/sahil454521/sarkari-saathi
>
> If you've ever filled a scheme form for a parent or grandparent, which scheme should I add next?
>
> @Gnani AI #GnaniAI #GreatIndianAIInternshipChallenge

## X thread

Posted 2026-10-22 (tags @GnaniAi): https://x.com/Sahilpathak2105/status/2113327134072795560

1/ आप बोलिए, फ़ॉर्म अपने-आप भरेगा।
I built Sarkari Saathi: talk to it in Marathi, Hindi or English and it finds the government schemes you may qualify for. You don't read, type or press anything between turns.
@GnaniAI #GnaniAI #GreatIndianAIInternshipChallenge 🧵 [attach the video]

2/ It asks a question, listens, and writes your answer into a form on screen as you speak. In the demo one Marathi sentence fills three fields at once, and four short answers later there are 8 schemes to check. (The demo user's voice is synthetic.)

3/ Stack: Gnani Prisma for speech-to-text, Gnani Timbre for the voice, and a small LLM (Gemini Flash-Lite) that only extracts facts. Each reply comes back in about 3 seconds.

4/ The rule I built it on: the AI listens, the code decides. All 13 schemes are plain eligibility rules taken from government pages, so it can't invent a scheme or promise money.

5/ Try it: https://sarkari-saathi-kjgb.onrender.com
Code: https://github.com/sahil454521/sarkari-saathi
Which scheme should I add next?

## Submission form

**Project title:** Sarkari Saathi: find government schemes by voice

**Problem being solved:** People who can't comfortably read or type, often the very people welfare schemes are meant for, have to work through written forms to learn what they qualify for. Many never find out.

**Target users:** Rural and semi-urban residents of Maharashtra and Hindi-speaking users, especially women farmers, elderly people, street vendors and families with young daughters, plus the relatives and CSC operators who help them.

**What it does:** A hands-free, voice-first mobile web app. The user speaks in Marathi, Hindi or English; the app asks only the questions that still matter, fills a form on screen as they talk, and lists the central and Maharashtra schemes they may qualify for, with benefits, documents to carry, official links and read-aloud.

**Gnani AI models / APIs used:**
- **Prisma v2.5 (speech-to-text, REST):** transcribes every spoken turn in hi-IN, mr-IN and en-IN, with number normalisation; long answers are sent in pieces cut at pauses.
- **Timbre v3.0 (text-to-speech):** speaks every reply, the greeting and each scheme card.

Fact extraction uses Gemini Flash-Lite through an OpenAI-compatible endpoint; Gnani Evon can replace it through configuration once it is hosted.

**Contribution:** Solo entry. Sahil Pathak: product design, eligibility research, backend (Express, TypeScript, zod), rules engine and question picker, Gnani integration, hands-free mobile UI (React, Tailwind), tests, deployment and demo.
