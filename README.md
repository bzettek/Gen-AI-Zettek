# FlowTV

FlowTV is a voice controlled TV system for people in senior living. You just say what you want to watch and it plays it, doesn't matter if it's on a streaming service or cable. No menus and no remote.

## What the first working slice does

I built one flow around a resident I'm calling Margaret (Room 214).

1. She asks for something. She can tap the mic and talk or type what she would say, like "Put on the movie where the ship sinks with Leonardo DiCaprio"
2. FlowTV figures out what she means and where it is. The "Under the hood" panel on the right shows each step and what the AI would send back
3. The TV plays it. The screen shows what's playing, what service or cable channel it's on, and where it started

It handles 5 kinds of requests right now:

- Movie or show by describing it: "the movie where the ship sinks with Leonardo DiCaprio" plays Titanic on streaming
- Live TV on cable: "Put on the Cubs game" switches to the game on local cable, Ch. 32
- Jumping to a scene: "Go back to right after Sonny gets killed" plays The Godfather from 1:51:04
- Resume: "What was I watching yesterday?" picks The Golden Girls back up where she left off
- Unclear requests: "Put on that boat movie" asks her which one she meant and gives 3 options

If it can't find anything it gives her some things to try so she isn't stuck. If she misses twice in a row it shows that staff got notified, since right now staff helping is basically how this problem gets solved.

## How to open and test it

Live link: https://bzettek.github.io/Gen-AI-Zettek/

Open it in Chrome, tap the mic, and allow microphone access. The mic works in Chrome so you can just talk to it.

You can also type a request or click one of the "Try one" examples. "Back to home screen" resets everything.

## AI: what works and what's simulated

This is a Wizard of Oz prototype. The experience is what I want it to be but most of the "smart" stuff behind it is faked for now so I could test the idea before building the hard parts.

What I want the real AI to do:
- Understand vague, normal requests like "the ship movie with DiCaprio" and turn that into an actual title, service, and start time
- Search inside a movie or show using captions and scene understanding to find the part someone is describing
- Know if something is on a streaming service (signed in and running in the cloud) or on local cable, then open it with a deep link or switch the TV input in 1 to 2 seconds
- Ask a quick follow up question when a request isn't clear and let staff know when someone is stuck

What actually works vs. what's simulated:
- Speech to text: working. It uses Chrome's built in speech recognition so the mic works in Chrome
- Understanding the request: simulated. resolve() in app.js just matches keywords against a small catalog I made of 11 sample titles and channels (catalog.js). There's no AI model or API hooked up yet
- Scene search: simulated. I wrote the scene descriptions and timestamps into catalog.js ahead of time
- Finding the service/channel and playing it: simulated. The TV screen is a mock up. Nothing actually streams and no deep links or cable commands get sent. Which service has which title, the channel numbers, and the timestamps are all made up sample data
- Follow up questions and staff alerts: simulated with simple rules. If the keyword scores are close it asks a question, and 2 misses in a row triggers the staff alert
- The "Under the hood" steps and AI output: simulated. I prewrote these to show the kind of output a real AI agent would give back

No API keys, passwords, or anything like that are in this repo.

## Test results

I tested everything in Chrome by typing the requests in.

| Test | Input or action | What happened | Pass, partial, or fail |
| --- | --- | --- | --- |
| Typical case | Typed "Put on the movie where the ship sinks with Leonardo DiCaprio" | Titanic came up playing on Prime Video from 0:00:00 with "Opened in 0.7 s". All 5 steps showed in the panel and the AI output said play_title with a deep link | Pass |
| Challenge case | Typed "Put on that boat movie" then "number 2" | It asked "Which one did you mean?" and gave Titanic, Jaws, and Pirates of the Caribbean. Saying "number 2" played Jaws. First time I ran it "number 2" didn't work so I fixed it and ran it again | Pass |
| Invalid or empty case | Hit Ask with nothing typed, then typed "Turn the heat up" twice | Empty got "I didn't catch that. Try again." The heat one gave a list of example requests and the second time it also said "I've let the staff know you might need a hand". Never dead ended | Pass |

## Known limitations

1. The "AI" is really just keyword matching. It only knows my 11 sample titles and channels, so something totally normal like "put on Bonanza" ends up on the "not sure" screen. Next step would be swapping resolve() for an actual language model that gives back the same kind of output.
2. Playback is a mock up. Nothing is actually controlling a streaming service, deep link, or cable box, so the 0.7 s and 1.1 s switch times are what I'm going for, not something I measured.
3. Tap to talk is standing in for the always on mic. The real thing would be listening all the time, so it needs a wake word and a real privacy plan since it's a mic in someone's room.

## Files

- index.html: page layout (TV screen, ask bar, Under the hood panel)
- style.css: styling
- app.js: speech input, the fake resolve() step, and what shows up on the TV
- catalog.js: sample titles, channels, scenes, and keywords that stand in for what the AI would know
