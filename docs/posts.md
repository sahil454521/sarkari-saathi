# Post drafts

Replace `[LINK]` and `[GITHUB]` before posting, and tag Gnani AI's page (type "@Gnani" and pick it from the list). If a family member's story is behind this, add it as a second paragraph: a true personal line will do more than anything below.

If you record the demo on Gemini rather than Evon, replace "Gnani Evon" with "an LLM" everywhere below; the contest rules ban misleading demos. Check Gnani AI's exact handle on X before posting.

## LinkedIn

> आप बोलिए, फ़ॉर्म अपने-आप भरेगा।
> Speak, and the form fills itself in.
>
> A woman farmer in Nashik may qualify for several government schemes. To find out which, she has to get through forms that assume she can read and type.
>
> So for the Great Indian AI Internship Challenge I built Sarkari Saathi. You talk to it in Marathi, Hindi or English. It asks short questions out loud, writes your answers into a form on screen as you speak, and tells you which of 13 central and Maharashtra schemes you may qualify for, with the documents to carry.
>
> In the demo, one Marathi sentence fills three fields at once: ration card, daughter's age and family income. Four short answers later she has 8 schemes, and she can tap any card to hear it read aloud.
>
> How it works:
> 1) Gnani Prisma turns her speech into text ("पंचेचाळीस" arrives as 45).
> 2) Gnani Evon picks out the facts.
> 3) Plain code checks them against eligibility rules taken from the official scheme pages.
> 4) Gnani Timbre speaks every reply back.
>
> The AI listens and the code decides, so it can't invent a scheme or promise money that isn't there.
>
> Each turn takes about 3 seconds, and nothing she says is stored.
>
> Try it: [LINK]
> Code: [GITHUB]
>
> If you've ever filled a scheme form for a parent or grandparent, which scheme should I add next?
>
> @Gnani AI #GnaniAI #GreatIndianAIInternshipChallenge

## X thread

1/ आप बोलिए, फ़ॉर्म अपने-आप भरेगा।
I built Sarkari Saathi: talk to it in Marathi, Hindi or English and it tells you which government schemes you may qualify for, without you reading or typing anything.
@GnaniAI #GnaniAI #GreatIndianAIInternshipChallenge 🧵

2/ It asks short questions out loud and writes your answers into a form on screen while you talk. One Marathi sentence filled three fields at once in my demo. [attach the 60-second video]

3/ Stack: Gnani Prisma for speech-to-text, Gnani Evon to pull out facts, Gnani Timbre to speak back. About 3 seconds a turn.

4/ The rule I built it on: the AI listens, the code decides. Eligibility for all 13 schemes is plain code checked against the official pages, so it can't invent a scheme or promise money.

5/ Try it: [LINK]
Code: [GITHUB]
Which scheme should I add next?

## Submission form

**Project title:** Sarkari Saathi: find government schemes by voice

**Problem being solved:** People who can't comfortably read or type, often the very people welfare schemes are meant for, have to work through written forms to learn what they qualify for. Many never find out.

**Target users:** Rural and semi-urban residents of Maharashtra and Hindi-speaking users, especially women farmers, elderly people, street vendors and families with young daughters, plus the relatives and CSC operators who help them.

**What it does:** A voice-first mobile web app. The user speaks in Marathi, Hindi or English. The app asks only the questions that still matter, fills a form on screen as they talk, and lists the central and Maharashtra schemes they may qualify for, with benefits, documents to carry, official links and a read-aloud option.

**Gnani AI models / APIs used:**
- **Prisma v2.5 (speech-to-text, REST):** transcribes every spoken turn in hi-IN, mr-IN and en-IN, with inverse text normalisation.
- **Timbre v3.0 (text-to-speech):** speaks every reply, the greeting and each scheme card.
- **Evon v3.3 (LLM):** extracts facts from what the user says, served through an OpenAI-compatible endpoint for the demo.

**Contribution:** Solo entry. Sahil Pathak: product design, eligibility research, backend (Express, TypeScript, zod), rules engine and question picker, Gnani integration, mobile UI (React, Tailwind), tests, deployment and demo.
